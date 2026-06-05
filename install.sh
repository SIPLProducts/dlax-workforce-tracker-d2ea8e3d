#!/usr/bin/env bash
# =============================================================================
# DLAX install script — AWS-friendly, nginx reverse proxy on port 80
#
# Usage (fresh Ubuntu 22.04 / 24.04 EC2 instance):
#   cd <unzipped-repo>
#   chmod +x install.sh
#   sudo ADMIN_PASSWORD='YourPass#2026' ./install.sh
#
# After it finishes (open inbound tcp 80, 3000, 8000, 8001 in your AWS SG):
#   App      : http://<SERVER_IP>/        or  http://<SERVER_IP>:3000/
#   Supabase : http://<SERVER_IP>:8000
#   Studio   : http://<SERVER_IP>:8001
# =============================================================================
set -Eeuo pipefail

# ---------- config ------------------------------------------------------------
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPA="$SRC/supabase-stack"

# Final deployment directory (frontend + backend live here, NOT in the repo)
DEPLOY="/root/DLAX"
# NOTE: must be /root/DLAX/client — the generated dist/server/wrangler.json
# has assets.directory="../client", resolved relative to BACKEND cwd.
FRONTEND="$DEPLOY/client"
BACKEND="$DEPLOY/backend"

APP_PORT="${APP_PORT:-3000}"             # bound to 0.0.0.0 (public)
SUPABASE_API_PORT="${SUPABASE_API_PORT:-8000}"   # kong, bound to 0.0.0.0 (public)
STUDIO_PORT="${STUDIO_PORT:-8001}"       # studio, bound to 0.0.0.0 (public)

# Public IP auto-detect: IMDSv2 → ipify → LAN → loopback. SERVER_IP= env overrides.
detect_ip() {
  local ip token
  token=$(curl -fsS --max-time 2 -X PUT \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 60" \
    http://169.254.169.254/latest/api/token 2>/dev/null || true)
  if [ -n "$token" ]; then
    ip=$(curl -fsS --max-time 2 -H "X-aws-ec2-metadata-token: $token" \
      http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
    [ -n "$ip" ] && { echo "$ip"; return; }
  fi
  ip=$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || true)
  [ -n "$ip" ] && { echo "$ip"; return; }
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ -n "$ip" ] && { echo "$ip"; return; }
  echo "127.0.0.1"
}
SERVER_IP="${SERVER_IP:-$(detect_ip)}"

ADMIN_LOGIN_ID="${ADMIN_LOGIN_ID:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dlax.local}"
DB_CONTAINER="dlax-db"
AUTH_CONTAINER="dlax-auth"

# ---------- logging -----------------------------------------------------------
G=$'\033[32m'; B=$'\033[34m'; Y=$'\033[33m'; R=$'\033[31m'; N=$'\033[0m'
log()  { printf '%s[dlax]%s %s\n' "$B" "$N" "$*"; }
ok()   { printf '%s[ ok ]%s %s\n' "$G" "$N" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$Y" "$N" "$*"; }
die()  { printf '%s[fail]%s %s\n' "$R" "$N" "$*" >&2; exit 1; }
trap 'die "install.sh failed at line $LINENO"' ERR

[ "$(id -u)" -eq 0 ]       || die "run as root: sudo ./install.sh"
[ -f "$SRC/package.json" ] || die "missing package.json — run this from the unzipped repo root"
[ -d "$SUPA" ]             || die "missing supabase-stack/ next to install.sh"

# =============================================================================
# 1) System deps
# =============================================================================
log "installing system deps"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y --no-install-recommends \
  curl ca-certificates gnupg lsb-release jq openssl rsync nginx gettext-base >/dev/null
ok "apt deps ready (incl. nginx, envsubst)"

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  log "installing Docker Engine + compose"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y >/dev/null
  apt-get install -y --no-install-recommends \
    docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null
fi
ok "docker $(docker --version | awk '{print $3}' | tr -d ,)"

if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]; then
  log "installing Node 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y --no-install-recommends nodejs >/dev/null
fi
ok "node $(node -v)"

if ! command -v bun >/dev/null; then
  log "installing bun"
  curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash >/dev/null
  ln -sf /usr/local/bin/bun /usr/local/bin/bunx
fi
ok "bun $(bun -v)"

if ! command -v pm2 >/dev/null; then
  log "installing pm2"
  npm install -g pm2 >/dev/null
fi
ok "pm2 $(pm2 -v)"

if ! command -v wrangler >/dev/null; then
  log "installing wrangler (bundles workerd runtime)"
  npm install -g wrangler >/dev/null
fi
ok "wrangler $(wrangler --version 2>/dev/null | head -n1)"

# =============================================================================
# 2) Wipe previous install
# =============================================================================
log "wiping previous install"
pm2 delete dlax >/dev/null 2>&1 || true
[ -f "$SUPA/docker-compose.yml" ] && ( cd "$SUPA" && docker compose down -v --remove-orphans >/dev/null 2>&1 || true )
cids=$(docker ps -aq --filter "name=^dlax-" 2>/dev/null || true)
[ -n "$cids" ] && docker rm -f $cids >/dev/null 2>&1 || true
for v in dlax-supabase_db-data dlax-supabase_storage-data; do
  docker volume rm -f "$v" >/dev/null 2>&1 || true
done
rm -rf "$FRONTEND" "$BACKEND" "$SRC/.output" "$SRC/dist" "$SRC/node_modules" "$SRC/.env" "$SUPA/.env" "$SUPA/volumes/api/kong.yml" || true
rm -f /etc/nginx/sites-enabled/dlax /etc/nginx/sites-available/dlax /etc/nginx/sites-enabled/default || true
mkdir -p "$FRONTEND" "$BACKEND"
ok "wipe complete"

# =============================================================================
# 3) Generate supabase-stack/.env
# =============================================================================
b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }
mint_jwt() {
  local role="$1" secret="$2" iat exp h p s
  iat=$(date +%s); exp=$((iat + 60*60*24*365*10))
  h=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  p=$(printf '{"role":"%s","iss":"supabase","iat":%d,"exp":%d}' "$role" "$iat" "$exp" | b64url)
  s=$(printf '%s.%s' "$h" "$p" | openssl dgst -binary -sha256 -hmac "$secret" | b64url)
  printf '%s.%s.%s\n' "$h" "$p" "$s"
}

log "generating supabase-stack/.env"
PG_PASS=$(openssl rand -hex 24)
JWT=$(openssl rand -hex 32)
DASH_PASS=$(openssl rand -hex 12)
ANON=$(mint_jwt anon "$JWT")
SRK=$(mint_jwt service_role "$JWT")

cat > "$SUPA/.env" <<EOF
# generated by install.sh on $(date -u +%FT%TZ)
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_HOST=db
JWT_SECRET=$JWT
JWT_EXPIRY=3600
ANON_KEY=$ANON
SERVICE_ROLE_KEY=$SRK

DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=$DASH_PASS

SITE_URL=http://$SERVER_IP:$APP_PORT/
ADDITIONAL_REDIRECT_URLS=http://$SERVER_IP:$APP_PORT/,http://$SERVER_IP/
API_EXTERNAL_URL=http://$SERVER_IP:$SUPABASE_API_PORT
SUPABASE_PUBLIC_URL=http://$SERVER_IP:$SUPABASE_API_PORT

KONG_HTTP_PORT=$SUPABASE_API_PORT
STUDIO_PORT=$STUDIO_PORT

DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false

SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=DLAX
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify
EOF
chmod 600 "$SUPA/.env"
ok "wrote supabase-stack/.env (back this up — losing it = losing access)"

log "rendering kong.yml from template (substituting anon/service JWTs)"
[ -f "$SUPA/volumes/api/kong.yml.template" ] || die "missing $SUPA/volumes/api/kong.yml.template"
SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_KEY="$SRK" \
  envsubst '${SUPABASE_ANON_KEY} ${SUPABASE_SERVICE_KEY}' \
  < "$SUPA/volumes/api/kong.yml.template" \
  > "$SUPA/volumes/api/kong.yml"
if grep -q '\${SUPABASE_' "$SUPA/volumes/api/kong.yml"; then
  die "kong.yml still has unsubstituted placeholders — envsubst failed"
fi
ok "kong.yml rendered"

# =============================================================================
# 4) Start Supabase
# =============================================================================
log "starting Supabase containers"
( cd "$SUPA" && docker compose up -d )

log "waiting for db to become healthy"
for i in $(seq 1 120); do
  s=$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo starting)
  [ "$s" = "healthy" ] && { ok "db healthy"; break; }
  sleep 2
  [ "$i" = 120 ] && die "db never healthy — check: cd $SUPA && docker compose logs db"
done

log "waiting for GoTrue migrations to finish"
for i in $(seq 1 90); do
  if docker logs "$AUTH_CONTAINER" 2>&1 | grep -qiE 'GoTrue.*started|listening on|API started'; then
    ok "auth started"; break
  fi
  sleep 2
  if [ "$i" = 90 ]; then
    warn "auth slow to log readiness — recent log tail:"
    docker logs --tail 80 "$AUTH_CONTAINER" || true
  fi
done

log "waiting for kong → auth health on 127.0.0.1:$SUPABASE_API_PORT/auth/v1/health"
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$SUPABASE_API_PORT/auth/v1/health" || echo 000)
  [ "$code" = "200" ] && { ok "Supabase API up"; break; }
  sleep 2
  if [ "$i" = 60 ]; then
    warn "Supabase API not returning 200 (last code=$code). Recent auth + kong logs:"
    docker logs --tail 60 "$AUTH_CONTAINER" || true
    docker logs --tail 30 dlax-kong || true
    die "Supabase API never became ready"
  fi
done

# =============================================================================
# 5) Apply migrations
# =============================================================================
MDIR="$SRC/supabase/migrations"
if [ -d "$MDIR" ] && ls "$MDIR"/*.sql >/dev/null 2>&1; then
  log "applying migrations from supabase/migrations/"
  docker exec "$DB_CONTAINER" sh -c 'mkdir -p /tmp/dlax-mig && rm -f /tmp/dlax-mig/*.sql'
  for f in $(ls "$MDIR"/*.sql | sort); do
    base=$(basename "$f")
    docker cp "$f" "$DB_CONTAINER:/tmp/dlax-mig/$base" >/dev/null
    log "  -> $base"
    docker exec --user postgres "$DB_CONTAINER" \
      psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/tmp/dlax-mig/$base" >/dev/null \
      || die "migration $base failed — see: docker logs $DB_CONTAINER"
  done
  ok "migrations applied"
else
  warn "no migrations directory"
fi

# =============================================================================
# 5b) Data API grants — self-hosted Supabase has no implicit grants on public
# =============================================================================
log "granting Data API privileges on public schema"
docker exec --user postgres "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
-- Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Default privileges for future objects created by postgres
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Backfill grants on existing base tables in public
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE c.relkind = 'r' AND n.nspname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END $$;

-- Sequences + functions (anon needs EXECUTE on get_email_for_login_id RPC)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
SQL
ok "Data API grants applied"

# Sanity check — diagnostic probe; accept either signal as success
RAW=$(docker exec --user postgres "$DB_CONTAINER" \
  psql -tAXU postgres -d postgres \
  -c "SELECT has_table_privilege('authenticated','public.user_roles','SELECT')::text" 2>&1)
log "  has_table_privilege => [$RAW]"

GRANTS=$(docker exec --user postgres "$DB_CONTAINER" \
  psql -tAXU postgres -d postgres \
  -c "SELECT COALESCE(string_agg(privilege_type, ','), '') FROM information_schema.role_table_grants WHERE grantee='authenticated' AND table_schema='public' AND table_name='user_roles'" 2>&1)
log "  role_table_grants  => [$GRANTS]"

PRIV_OK=0
case "$RAW" in *t) PRIV_OK=1 ;; esac
case "$GRANTS" in *SELECT*) PRIV_OK=1 ;; esac

if [ "$PRIV_OK" != "1" ]; then
  OWNER=$(docker exec --user postgres "$DB_CONTAINER" \
    psql -tAXU postgres -d postgres \
    -c "SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename='user_roles'" 2>&1)
  warn "user_roles owner is [$OWNER] — retrying grants via SET ROLE as owner"
  docker exec --user postgres "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND n.nspname='public'
  LOOP
    EXECUTE format('SET LOCAL ROLE %I', t.owner);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
    RESET ROLE;
  END LOOP;
END $$;
SQL
  RAW2=$(docker exec --user postgres "$DB_CONTAINER" \
    psql -tAXU postgres -d postgres \
    -c "SELECT has_table_privilege('authenticated','public.user_roles','SELECT')::text" 2>&1)
  log "  has_table_privilege (after retry) => [$RAW2]"
  case "$RAW2" in *t) PRIV_OK=1 ;; esac
fi

[ "$PRIV_OK" = "1" ] || die "grant verification failed: authenticated still lacks SELECT on public.user_roles"
ok "verified: authenticated can SELECT public.user_roles"



# Tell PostgREST to reload its schema cache so freshly created functions
# (e.g. public.get_email_for_login_id) become visible via /rest/v1/rpc/...
log "reloading PostgREST schema cache"
docker exec --user postgres "$DB_CONTAINER" \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';" >/dev/null || warn "schema reload NOTIFY failed (continuing)"
# Belt-and-suspenders: restart PostgREST so it definitely re-reads the schema
docker restart dlax-rest >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:$SUPABASE_API_PORT/rest/v1/" -H "apikey: $ANON" || echo 000)
  case "$code" in 200|301|302|404) ok "PostgREST ready"; break ;; esac
  sleep 1
done

# =============================================================================
# 6) Seed admin user (auth user + profile + role) and verify login works
# =============================================================================
log "seeding admin user ($ADMIN_LOGIN_ID / $ADMIN_EMAIL)"

# Wipe any pre-existing admin row in the DB so re-runs are idempotent
docker exec --user postgres "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = '$ADMIN_EMAIL');
DELETE FROM public.profiles  WHERE user_id IN (SELECT id FROM auth.users WHERE email = '$ADMIN_EMAIL');
DELETE FROM auth.users WHERE email = '$ADMIN_EMAIL';
" >/dev/null

RESP=$(mktemp)
HTTP=$(curl -sS -o "$RESP" -w '%{http_code}' \
  -X POST "http://127.0.0.1:$SUPABASE_API_PORT/auth/v1/admin/users" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  --data "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" --arg l "$ADMIN_LOGIN_ID" \
    '{email:$e, password:$p, email_confirm:true, user_metadata:{login_id:$l, display_name:"Administrator"}}')")
if [ "$HTTP" != "200" ] && [ "$HTTP" != "201" ]; then
  cat "$RESP"; rm -f "$RESP"
  die "admin create failed (HTTP $HTTP)"
fi
ADMIN_UID=$(jq -r '.id' < "$RESP")
rm -f "$RESP"
[ -n "$ADMIN_UID" ] && [ "$ADMIN_UID" != "null" ] || die "could not parse admin user id from auth response"
ok "admin auth user created (uid=$ADMIN_UID)"

# Ensure profile row has the requested login_id and admin role exists.
# The handle_new_user trigger usually does this, but we force it to be safe.
docker exec --user postgres "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
INSERT INTO public.profiles (user_id, email, display_name, login_id)
VALUES ('$ADMIN_UID', '$ADMIN_EMAIL', 'Administrator', '$ADMIN_LOGIN_ID')
ON CONFLICT (user_id) DO UPDATE
  SET login_id = EXCLUDED.login_id,
      email = EXCLUDED.email,
      display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

INSERT INTO public.user_roles (user_id, role)
VALUES ('$ADMIN_UID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
" >/dev/null || die "failed to upsert admin profile/role"
ok "admin profile + role ensured (login_id=$ADMIN_LOGIN_ID)"

# Verify: login_id resolves via the public RPC the browser actually calls.
# PostgREST caches its schema; retry while nudging it to reload if the
# function isn't visible yet (PGRST202).
log "verifying login_id RPC resolves to admin email"
RPC_EMAIL=""
RPC_RESP=""
for attempt in 1 2 3 4 5 6; do
  RPC_RESP=$(curl -sS -X POST \
    "http://127.0.0.1:$SUPABASE_API_PORT/rest/v1/rpc/get_email_for_login_id" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    -H "Content-Type: application/json" \
    --data "$(jq -n --arg l "$ADMIN_LOGIN_ID" '{_login_id:$l}')")
  RPC_EMAIL=$(echo "$RPC_RESP" | jq -r 'if type=="string" then . else empty end')
  [ "$RPC_EMAIL" = "$ADMIN_EMAIL" ] && break
  # If the function is missing from the schema cache, nudge PostgREST.
  if echo "$RPC_RESP" | grep -q 'PGRST202'; then
    warn "RPC not in schema cache yet (attempt $attempt) — reloading PostgREST"
    docker exec --user postgres "$DB_CONTAINER" psql -U postgres -d postgres \
      -c "NOTIFY pgrst, 'reload schema';" >/dev/null 2>&1 || true
    docker restart dlax-rest >/dev/null 2>&1 || true
    sleep 3
  else
    sleep 2
  fi
done
if [ "$RPC_EMAIL" != "$ADMIN_EMAIL" ]; then
  warn "RPC response: $RPC_RESP"
  warn "diagnosing in-database state:"
  docker exec --user postgres "$DB_CONTAINER" psql -U postgres -d postgres -c \
    "SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='get_email_for_login_id';" || true
  docker exec --user postgres "$DB_CONTAINER" psql -U postgres -d postgres -c \
    "SELECT user_id, login_id, email FROM public.profiles WHERE lower(login_id)=lower('$ADMIN_LOGIN_ID');" || true
  die "get_email_for_login_id('$ADMIN_LOGIN_ID') did not return $ADMIN_EMAIL — if pg_proc shows the function exists, restart the rest container: docker restart dlax-rest"
fi
ok "login_id RPC OK ($ADMIN_LOGIN_ID -> $ADMIN_EMAIL)"

# Verify: password sign-in actually works against the same API
log "verifying password sign-in via /auth/v1/token"
TOK_RESP=$(curl -sS -X POST \
  "http://127.0.0.1:$SUPABASE_API_PORT/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  --data "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e, password:$p}')")
if ! echo "$TOK_RESP" | jq -e '.access_token' >/dev/null 2>&1; then
  warn "token response: $TOK_RESP"
  die "password sign-in failed for $ADMIN_EMAIL — check GOTRUE logs"
fi
ok "admin password sign-in verified"

# =============================================================================
# 7) Build the app
# =============================================================================
log "writing app .env"
cat > "$SRC/.env" <<EOF
VITE_SUPABASE_URL=http://$SERVER_IP:$SUPABASE_API_PORT
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON
VITE_SUPABASE_PROJECT_ID=local

SUPABASE_URL=http://127.0.0.1:$SUPABASE_API_PORT
SUPABASE_PUBLISHABLE_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SRK

PORT=$APP_PORT
HOST=127.0.0.1
NODE_ENV=production
EOF
chmod 600 "$SRC/.env"

log "bun install"
( cd "$SRC" && bun install --no-progress )

log "build env: SERVER_IP=$SERVER_IP  VITE_SUPABASE_URL=http://$SERVER_IP:$SUPABASE_API_PORT"
log "bun run build"
( cd "$SRC" && bun run build )
[ -d "$SRC/dist/server" ] || die "build did not produce dist/server/"
[ -d "$SRC/dist/client" ] || die "build did not produce dist/client/"

if grep -r -l "nip\.io" "$SRC/dist" >/dev/null 2>&1; then
  grep -r -l "nip\.io" "$SRC/dist" || true
  die "stale nip.io URL leaked into build output — aborting deploy"
fi

log "deploying → $FRONTEND + $BACKEND"
rm -rf "$FRONTEND" "$BACKEND"
mkdir -p "$FRONTEND" "$BACKEND"
rsync -a --delete "$SRC/dist/client/" "$FRONTEND/"
rsync -a --delete "$SRC/dist/server/" "$BACKEND/"

# wrangler reads .dev.vars from cwd → exposed inside the worker as process.env.*
cat > "$BACKEND/.dev.vars" <<EOF
SUPABASE_URL=http://127.0.0.1:$SUPABASE_API_PORT
SUPABASE_PUBLISHABLE_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SRK
EOF
chmod 600 "$BACKEND/.dev.vars"

# Reconcile wrangler.json `main` with the actual emitted entry file.
# Nitro's cloudflare-module preset may emit index.js or index.mjs depending on
# version. Trust whichever file exists and rewrite wrangler.json to match —
# do NOT rename the file, because the worker imports sibling chunks by extension.
[ -f "$BACKEND/wrangler.json" ] || die "missing $BACKEND/wrangler.json"
ENTRY=""
for cand in index.js index.mjs; do
  [ -f "$BACKEND/$cand" ] && { ENTRY="$cand"; break; }
done
[ -n "$ENTRY" ] || die "missing worker entry (index.js / index.mjs) in $BACKEND — nitro plugin likely did not run"
log "worker entry: $ENTRY — syncing wrangler.json main field"
TMP_WJ=$(mktemp)
jq --arg m "$ENTRY" '.main = $m' "$BACKEND/wrangler.json" > "$TMP_WJ" \
  && mv "$TMP_WJ" "$BACKEND/wrangler.json"
ok "worker bundle ready: $BACKEND/$ENTRY"

# =============================================================================
# 8) PM2 — run worker via wrangler/workerd (bound to 0.0.0.0)
# =============================================================================
log "starting backend under PM2 (wrangler dev → 0.0.0.0:$APP_PORT)"
pm2 delete dlax >/dev/null 2>&1 || true
# --no-bundle / no_bundle is already set inside wrangler.json — don't duplicate
# it on the CLI. Let the config file be the single source of truth.
pm2 start wrangler --name dlax --cwd "$BACKEND" --update-env -- \
  dev --local --ip 0.0.0.0 --port "$APP_PORT" --config wrangler.json

log "waiting for backend to listen on 127.0.0.1:$APP_PORT"
READY=0
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$APP_PORT/" 2>/dev/null || echo 000)
  case "$code" in 2*|3*|4*) READY=1; break ;; esac
  sleep 2
done
if [ "$READY" != "1" ]; then
  warn "backend never responded on :$APP_PORT — recent PM2 error logs:"
  pm2 logs dlax --lines 80 --nostream --err || true
  die "wrangler worker failed to start — see logs above"
fi
ok "backend responding on :$APP_PORT"

pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# =============================================================================
# 9) Nginx reverse proxy (port 80 only)
# =============================================================================
log "configuring nginx reverse proxy on :80"
cat > /etc/nginx/sites-available/dlax <<NGINX
server {
  listen 80 default_server;
  server_name _;

  client_max_body_size 50m;

  # Static frontend (built assets shipped to $FRONTEND)
  root $FRONTEND;
  index index.html;

  # Try static file first; fall through to the SSR/server-fn process
  location / {
    try_files \$uri @ssr;
  }

  location @ssr {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
  }

  # Supabase API — /supabase/* → kong on 127.0.0.1:$SUPABASE_API_PORT
  location /supabase/ {
    rewrite ^/supabase/(.*)\$ /\$1 break;
    proxy_pass http://127.0.0.1:$SUPABASE_API_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
  }

  # Supabase Studio (admin DB UI)
  location /studio/ {
    rewrite ^/studio/(.*)\$ /\$1 break;
    proxy_pass http://127.0.0.1:$STUDIO_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}

NGINX
ln -sf /etc/nginx/sites-available/dlax /etc/nginx/sites-enabled/dlax
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null || die "nginx config invalid"
systemctl enable --now nginx >/dev/null
systemctl reload nginx
ok "nginx configured"

# =============================================================================
# 10) Summary
# =============================================================================
echo
printf '%s========================  DLAX is up  ========================%s\n' "$G" "$N"
printf '  App URL          : http://%s/   (or http://%s:%s/)\n' "$SERVER_IP" "$SERVER_IP" "$APP_PORT"
printf '  Supabase API     : http://%s:%s   (legacy: http://%s/supabase/)\n' "$SERVER_IP" "$SUPABASE_API_PORT" "$SERVER_IP"
printf '  Supabase Studio  : http://%s:%s   (legacy: http://%s/studio/)   (user: admin  pass: %s)\n' "$SERVER_IP" "$STUDIO_PORT" "$SERVER_IP" "$DASH_PASS"
printf '  App admin login  : %s   /   %s\n' "$ADMIN_LOGIN_ID" "$ADMIN_PASSWORD"
printf '  Frontend         : %s\n' "$FRONTEND"
printf '  Backend          : %s\n' "$BACKEND"
printf '  Secrets file     : %s/.env\n' "$SUPA"
printf '  Logs             : pm2 logs dlax  |  docker compose -f %s/docker-compose.yml logs -f  |  journalctl -u nginx -f\n' "$SUPA"
printf '%s==============================================================%s\n' "$G" "$N"
echo
warn "AWS Security Group: open inbound tcp 80, $APP_PORT, $SUPABASE_API_PORT, $STUDIO_PORT. Postgres (5432) stays bound to 127.0.0.1."
warn "Supabase Studio on :$STUDIO_PORT is publicly reachable — protected only by basic auth. Recommend restricting :$STUDIO_PORT in your SG to admin IPs only."
warn "Change the admin password after first login."
warn "App login uses User ID (e.g. '$ADMIN_LOGIN_ID'), NOT the email address. Users created in Studio must have profiles.login_id set to the value typed on the login page."
