#!/usr/bin/env bash
# =============================================================================
# DLAX install script — clean, minimal, idempotent
#
# Usage (on a fresh Ubuntu 22.04 / 24.04 server):
#   cd /root/DLAX        # the unzipped repo (contains package.json + supabase-stack/)
#   chmod +x install.sh
#   sudo -E ADMIN_PASSWORD='YourPass#2026' ./install.sh
#
# Every run wipes the previous install and rebuilds from scratch.
# When it finishes:
#   App      : http://<SERVER_IP>:3000
#   Supabase : http://<SERVER_IP>:8000
# =============================================================================
set -Eeuo pipefail

# ---------- config ------------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPA="$ROOT/supabase-stack"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"

APP_PORT="${APP_PORT:-3000}"
SUPABASE_API_PORT="${SUPABASE_API_PORT:-8000}"
SERVER_IP="${SERVER_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"

ADMIN_LOGIN_ID="${ADMIN_LOGIN_ID:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dlax.local}"
DB_CONTAINER="dlax-db"

# ---------- logging -----------------------------------------------------------
G=$'\033[32m'; B=$'\033[34m'; Y=$'\033[33m'; R=$'\033[31m'; N=$'\033[0m'
log()  { printf '%s[dlax]%s %s\n' "$B" "$N" "$*"; }
ok()   { printf '%s[ ok ]%s %s\n' "$G" "$N" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$Y" "$N" "$*"; }
die()  { printf '%s[fail]%s %s\n' "$R" "$N" "$*" >&2; exit 1; }
trap 'die "install.sh failed at line $LINENO"' ERR

[ "$(id -u)" -eq 0 ]        || die "run as root: sudo ./install.sh"
[ -f "$ROOT/package.json" ] || die "missing package.json — run this from the unzipped repo root"
[ -d "$SUPA" ]              || die "missing supabase-stack/ next to install.sh"

# =============================================================================
# 1) Install only what's needed (idempotent)
# =============================================================================
log "installing system deps"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y --no-install-recommends \
  curl ca-certificates gnupg lsb-release jq openssl rsync >/dev/null
ok "apt deps ready"

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
rm -rf "$FRONTEND" "$BACKEND" "$ROOT/.output" "$ROOT/node_modules" "$ROOT/.env" "$SUPA/.env" || true
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

SITE_URL=http://$SERVER_IP:$APP_PORT
ADDITIONAL_REDIRECT_URLS=http://$SERVER_IP:$APP_PORT
API_EXTERNAL_URL=http://$SERVER_IP:$SUPABASE_API_PORT
SUPABASE_PUBLIC_URL=http://$SERVER_IP:$SUPABASE_API_PORT

KONG_HTTP_PORT=$SUPABASE_API_PORT
KONG_HTTPS_PORT=8443
STUDIO_PORT=8001

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

log "waiting for API on :$SUPABASE_API_PORT"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$SUPABASE_API_PORT/auth/v1/health" >/dev/null 2>&1 \
     || curl -fsS "http://127.0.0.1:$SUPABASE_API_PORT/" >/dev/null 2>&1; then
    ok "API up"; break
  fi
  sleep 2
  [ "$i" = 60 ] && warn "API slow to respond — continuing"
done

# =============================================================================
# 5) Apply migrations + seed admin
# =============================================================================
MDIR="$ROOT/supabase/migrations"
if [ -d "$MDIR" ]; then
  log "applying migrations from supabase/migrations/"
  docker exec "$DB_CONTAINER" mkdir -p /tmp/dlax-mig
  docker exec "$DB_CONTAINER" sh -c 'rm -f /tmp/dlax-mig/*.sql'
  for f in $(ls "$MDIR"/*.sql 2>/dev/null | sort); do
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

log "seeding admin user ($ADMIN_LOGIN_ID / $ADMIN_EMAIL)"
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
rm -f "$RESP"
ok "admin user created"

# =============================================================================
# 6) Write app .env, build, and run under PM2
# =============================================================================
log "writing app .env"
cat > "$ROOT/.env" <<EOF
VITE_SUPABASE_URL=http://$SERVER_IP:$SUPABASE_API_PORT
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON
VITE_SUPABASE_PROJECT_ID=local

SUPABASE_URL=http://$SERVER_IP:$SUPABASE_API_PORT
SUPABASE_PUBLISHABLE_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SRK

PORT=$APP_PORT
HOST=0.0.0.0
NODE_ENV=production
EOF
chmod 600 "$ROOT/.env"

log "bun install"
( cd "$ROOT" && bun install --no-progress )

log "bun run build"
( cd "$ROOT" && bun run build )
[ -d "$ROOT/.output" ] || die "build did not produce .output/"

log "splitting build → frontend/ + backend/"
[ -d "$ROOT/.output/public" ] && rsync -a "$ROOT/.output/public/" "$FRONTEND/"
rsync -a --exclude='public' "$ROOT/.output/" "$BACKEND/"
cp -f "$ROOT/.env" "$BACKEND/.env"

ENTRY=""
for c in "$BACKEND/server/index.mjs" "$BACKEND/server/index.js" "$BACKEND/index.mjs"; do
  [ -f "$c" ] && { ENTRY="$c"; break; }
done
[ -n "$ENTRY" ] || ENTRY=$(find "$BACKEND" -maxdepth 4 -type f \( -name 'index.mjs' -o -name 'index.js' \) | head -n1)
[ -n "$ENTRY" ] || die "no server entry under $BACKEND"
ok "server entry: $ENTRY"

log "starting under PM2"
PORT=$APP_PORT HOST=0.0.0.0 NODE_ENV=production \
  pm2 start "$ENTRY" --name dlax --update-env --cwd "$BACKEND"
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# =============================================================================
# 7) Summary
# =============================================================================
echo
printf '%s========================  DLAX is up  ========================%s\n' "$G" "$N"
printf '  App URL          : http://%s:%s\n' "$SERVER_IP" "$APP_PORT"
printf '  Supabase API     : http://%s:%s\n' "$SERVER_IP" "$SUPABASE_API_PORT"
printf '    dashboard user : admin\n'
printf '    dashboard pass : %s\n' "$DASH_PASS"
printf '  App admin login  : %s   /   %s\n' "$ADMIN_LOGIN_ID" "$ADMIN_PASSWORD"
printf '  Secrets file     : %s/.env\n' "$SUPA"
printf '  PM2              : pm2 status dlax  |  pm2 logs dlax\n'
printf '%s==============================================================%s\n' "$G" "$N"
echo
warn "Open ports $APP_PORT and $SUPABASE_API_PORT in your firewall."
warn "Change the admin password after first login."
