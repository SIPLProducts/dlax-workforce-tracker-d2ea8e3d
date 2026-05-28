#!/usr/bin/env bash
# =============================================================================
# DLAX install script — AWS-friendly, nginx reverse proxy on port 80
#
# Usage (fresh Ubuntu 22.04 / 24.04 EC2 instance):
#   cd <unzipped-repo>
#   chmod +x install.sh
#   sudo ADMIN_PASSWORD='YourPass#2026' ./install.sh
#
# After it finishes (only inbound tcp/80 required in your AWS security group):
#   App      : http://<SERVER_IP>/
#   Supabase : http://<SERVER_IP>/supabase/
#   Studio   : http://<SERVER_IP>/studio/
# =============================================================================
set -Eeuo pipefail

# ---------- config ------------------------------------------------------------
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPA="$SRC/supabase-stack"

# Final deployment directory (frontend + backend live here, NOT in the repo)
DEPLOY="/root/DLAX"
FRONTEND="$DEPLOY/frontend"
BACKEND="$DEPLOY/backend"

APP_PORT="${APP_PORT:-3000}"             # internal only
SUPABASE_API_PORT="${SUPABASE_API_PORT:-8000}"   # internal only
STUDIO_PORT="${STUDIO_PORT:-8001}"       # internal only

SERVER_IP="${SERVER_IP:-$(curl -fsS --max-time 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)}"
[ -z "$SERVER_IP" ] && SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"

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
  curl ca-certificates gnupg lsb-release jq openssl rsync nginx >/dev/null
ok "apt deps ready (incl. nginx)"

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
rm -rf "$FRONTEND" "$BACKEND" "$SRC/.output" "$SRC/node_modules" "$SRC/.env" "$SUPA/.env" || true
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

SITE_URL=http://$SERVER_IP/
ADDITIONAL_REDIRECT_URLS=http://$SERVER_IP/
API_EXTERNAL_URL=http://$SERVER_IP/supabase
SUPABASE_PUBLIC_URL=http://$SERVER_IP/supabase

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
# 6) Seed admin user
# =============================================================================
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
# 7) Build the app
# =============================================================================
log "writing app .env"
cat > "$SRC/.env" <<EOF
VITE_SUPABASE_URL=http://$SERVER_IP/supabase
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

log "bun run build"
( cd "$SRC" && bun run build )
[ -d "$SRC/.output" ] || die "build did not produce .output/"

log "deploying → $FRONTEND + $BACKEND"
rm -rf "$FRONTEND" "$BACKEND"
mkdir -p "$FRONTEND" "$BACKEND"
[ -d "$SRC/.output/public" ] && rsync -a "$SRC/.output/public/" "$FRONTEND/"
rsync -a --exclude='public' "$SRC/.output/" "$BACKEND/"
cp -f "$SRC/.env" "$BACKEND/.env"

ENTRY=""
for c in "$BACKEND/server/index.mjs" "$BACKEND/server/index.js" "$BACKEND/index.mjs"; do
  [ -f "$c" ] && { ENTRY="$c"; break; }
done
[ -n "$ENTRY" ] || ENTRY=$(find "$BACKEND" -maxdepth 4 -type f \( -name 'index.mjs' -o -name 'index.js' \) | head -n1)
[ -n "$ENTRY" ] || die "no server entry under $BACKEND"
ok "server entry: $ENTRY"

# =============================================================================
# 8) PM2 (bound to 127.0.0.1)
# =============================================================================
log "starting backend under PM2 (127.0.0.1:$APP_PORT)"
PORT=$APP_PORT HOST=127.0.0.1 NODE_ENV=production \
  pm2 start "$ENTRY" --name dlax --update-env --cwd "$BACKEND"
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
printf '  App URL          : http://%s/\n' "$SERVER_IP"
printf '  Supabase API     : http://%s/supabase/\n' "$SERVER_IP"
printf '  Supabase Studio  : http://%s/studio/   (user: admin  pass: %s)\n' "$SERVER_IP" "$DASH_PASS"
printf '  App admin login  : %s   /   %s\n' "$ADMIN_LOGIN_ID" "$ADMIN_PASSWORD"
printf '  Frontend         : %s\n' "$FRONTEND"
printf '  Backend          : %s\n' "$BACKEND"
printf '  Secrets file     : %s/.env\n' "$SUPA"
printf '  Logs             : pm2 logs dlax  |  docker compose -f %s/docker-compose.yml logs -f  |  journalctl -u nginx -f\n' "$SUPA"
printf '%s==============================================================%s\n' "$G" "$N"
echo
warn "AWS Security Group: only inbound tcp/80 is required. All internal services (5432/8000/8001/$APP_PORT) bind to 127.0.0.1."
warn "Change the admin password after first login."
