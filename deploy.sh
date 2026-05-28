#!/usr/bin/env bash
# =============================================================================
# DLAX one-shot deployer (self-contained, idempotent)
#
# Usage on a fresh / dirty Ubuntu 22.04 or 24.04 server:
#   scp dlax-repo.zip root@SERVER:/root/ && ssh root@SERVER
#   cd /root && unzip dlax-repo.zip && mv dlax-* DLAX && cd DLAX
#   chmod +x deploy.sh
#   sudo -E ADMIN_PASSWORD='YourStrongPass#2026' ./deploy.sh
#
# Every run WIPES the previous install (DB volumes, build output, PM2 process)
# and rebuilds from scratch. End state:
#   - App  : http://SERVER_IP:3000        (PM2 process "dlax")
#   - Supa : http://SERVER_IP:8000        (Kong API + Studio)
# =============================================================================
set -Eeuo pipefail

# ---------- config (override via env) ----------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DLAX_ROOT="${DLAX_ROOT:-$SCRIPT_DIR}"
SOURCE_DIR="${SOURCE_DIR:-$DLAX_ROOT}"
SUPA_DIR="${SUPA_DIR:-$DLAX_ROOT/supabase-stack}"
FRONTEND_DIR="${FRONTEND_DIR:-$DLAX_ROOT/frontend}"
BACKEND_DIR="${BACKEND_DIR:-$DLAX_ROOT/backend}"

APP_PORT="${APP_PORT:-3000}"
SUPABASE_API_PORT="${SUPABASE_API_PORT:-8000}"
SERVER_IP="${SERVER_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"

ADMIN_LOGIN_ID="${ADMIN_LOGIN_ID:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dlax.local}"

DB_CONTAINER="${DB_CONTAINER:-dlax-db}"

# ---------- pretty logs -------------------------------------------------------
c_red=$'\033[31m'; c_grn=$'\033[32m'; c_ylw=$'\033[33m'; c_blu=$'\033[34m'; c_rst=$'\033[0m'
log()  { printf '%s[dlax]%s %s\n' "$c_blu" "$c_rst" "$*"; }
ok()   { printf '%s[ ok ]%s %s\n' "$c_grn" "$c_rst" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$c_ylw" "$c_rst" "$*"; }
die()  { printf '%s[fail]%s %s\n' "$c_red" "$c_rst" "$*" >&2; exit 1; }
trap 'die "deploy.sh failed at line $LINENO"' ERR

[ "$(id -u)" -eq 0 ] || die "run as root (sudo bash $0)"
[ -f "$SOURCE_DIR/package.json" ] || die "missing $SOURCE_DIR/package.json — run this script from the unzipped repo root"
[ -d "$SUPA_DIR" ]                || die "missing $SUPA_DIR — supabase-stack/ must sit next to deploy.sh"

# =============================================================================
# 1) Preflight: install OS deps (idempotent)
# =============================================================================
install_pkgs() {
  log "preflight: apt packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null
  apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg lsb-release jq openssl git rsync unzip uuid-runtime >/dev/null
}

install_docker() {
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
    ok "docker already installed"; return
  fi
  log "installing Docker Engine + compose"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y >/dev/null
  apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null
  ok "docker installed"
}

install_node_bun() {
  if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]; then
    log "installing Node 20 LTS"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y --no-install-recommends nodejs >/dev/null
  fi
  ok "node $(node -v)"
  if ! command -v bun >/dev/null; then
    log "installing Bun"
    curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash >/dev/null
    ln -sf /usr/local/bin/bun /usr/local/bin/bunx
  fi
  ok "bun $(bun -v)"
  if ! command -v pm2 >/dev/null; then
    log "installing PM2"
    npm install -g pm2 >/dev/null
  fi
  ok "pm2 $(pm2 -v)"
}

install_pkgs
install_docker
install_node_bun

# =============================================================================
# 2) WIPE previous install (always)
# =============================================================================
wipe_previous() {
  log "wiping previous install"
  # PM2
  pm2 delete dlax >/dev/null 2>&1 || true
  # Docker stack
  if [ -f "$SUPA_DIR/docker-compose.yml" ]; then
    ( cd "$SUPA_DIR" && docker compose down -v --remove-orphans >/dev/null 2>&1 || true )
  fi
  # Stray dlax-* containers
  local cids
  cids=$(docker ps -aq --filter "name=^dlax-" 2>/dev/null || true)
  [ -n "$cids" ] && docker rm -f $cids >/dev/null 2>&1 || true
  # Volumes
  for v in dlax-supabase_db-data dlax-supabase_storage-data; do
    docker volume rm -f "$v" >/dev/null 2>&1 || true
  done
  # Built artifacts
  rm -rf "$FRONTEND_DIR" "$BACKEND_DIR" \
         "$SOURCE_DIR/.output" "$SOURCE_DIR/node_modules" \
         "$SOURCE_DIR/.env" "$SUPA_DIR/.env" || true
  mkdir -p "$FRONTEND_DIR" "$BACKEND_DIR"
  ok "wipe complete"
}
wipe_previous

# =============================================================================
# 3) Generate Supabase .env (fresh secrets every run)
# =============================================================================
b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }

mint_jwt() {
  local role="$1" secret="$2" iat exp header payload sig
  iat=$(date +%s); exp=$((iat + 60*60*24*365*10))
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%d,"exp":%d}' "$role" "$iat" "$exp" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -binary -sha256 -hmac "$secret" | b64url)
  printf '%s.%s.%s\n' "$header" "$payload" "$sig"
}

write_supabase_env() {
  log "generating $SUPA_DIR/.env"
  local pg_pass jwt_secret anon srk dash_pass
  pg_pass=$(openssl rand -hex 24)
  jwt_secret=$(openssl rand -hex 32)
  dash_pass=$(openssl rand -hex 12)
  anon=$(mint_jwt anon "$jwt_secret")
  srk=$(mint_jwt service_role "$jwt_secret")
  cat > "$SUPA_DIR/.env" <<EOF
# Generated by deploy.sh on $(date -u +%FT%TZ)
POSTGRES_PASSWORD=$pg_pass
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_HOST=db
JWT_SECRET=$jwt_secret
JWT_EXPIRY=3600
ANON_KEY=$anon
SERVICE_ROLE_KEY=$srk

DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=$dash_pass

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
  chmod 600 "$SUPA_DIR/.env"
  ok "wrote $SUPA_DIR/.env (back this file up — losing it = losing access)"
}
write_supabase_env

# Load Supabase env for the rest of the script
set -a; . "$SUPA_DIR/.env"; set +a

# =============================================================================
# 4) Start Supabase
# =============================================================================
start_supabase() {
  log "starting Supabase stack"
  ( cd "$SUPA_DIR" && docker compose up -d )
  log "waiting for db to become healthy"
  for i in $(seq 1 120); do
    state=$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo starting)
    [ "$state" = "healthy" ] && { ok "db healthy"; break; }
    sleep 2
    [ "$i" = 120 ] && die "db never became healthy — try: cd $SUPA_DIR && docker compose logs db"
  done
  log "waiting for API on :$SUPABASE_API_PORT"
  for i in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$SUPABASE_API_PORT/auth/v1/health" >/dev/null 2>&1 \
       || curl -fsS "http://127.0.0.1:$SUPABASE_API_PORT/" >/dev/null 2>&1; then
      ok "API up"; return
    fi
    sleep 2
  done
  warn "API did not respond within 120s — continuing; check 'docker compose ps'"
}
start_supabase

# =============================================================================
# 5) Apply migrations + seed admin
# =============================================================================
apply_migrations() {
  local mdir="$SOURCE_DIR/supabase/migrations"
  [ -d "$mdir" ] || { warn "no migrations at $mdir — skipping"; return; }
  log "applying migrations from $mdir"
  docker exec "$DB_CONTAINER" mkdir -p /tmp/dlax-mig
  docker exec "$DB_CONTAINER" sh -c 'rm -f /tmp/dlax-mig/*.sql'
  for f in $(ls "$mdir"/*.sql 2>/dev/null | sort); do
    base=$(basename "$f")
    docker cp "$f" "$DB_CONTAINER:/tmp/dlax-mig/$base" >/dev/null
    log "  -> $base"
    if ! docker exec --user postgres "$DB_CONTAINER" \
        psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/tmp/dlax-mig/$base" >/dev/null; then
      die "migration $base failed — see: docker logs $DB_CONTAINER"
    fi
  done
  ok "migrations applied"
}

seed_admin() {
  log "seeding admin user ($ADMIN_LOGIN_ID / $ADMIN_EMAIL)"
  local resp http
  resp=$(mktemp)
  http=$(curl -sS -o "$resp" -w '%{http_code}' \
    -X POST "http://127.0.0.1:$SUPABASE_API_PORT/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    --data "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" --arg l "$ADMIN_LOGIN_ID" \
      '{email:$e, password:$p, email_confirm:true, user_metadata:{login_id:$l, display_name:"Administrator"}}')")
  if [ "$http" != "200" ] && [ "$http" != "201" ]; then
    warn "admin create HTTP $http: $(cat "$resp")"
    rm -f "$resp"; die "could not create admin via auth admin API"
  fi
  rm -f "$resp"
  ok "admin user created (handle_new_user trigger promoted to admin role)"
}

apply_migrations
seed_admin

# =============================================================================
# 6) Build the app
# =============================================================================
write_app_env() {
  log "writing $SOURCE_DIR/.env"
  cat > "$SOURCE_DIR/.env" <<EOF
VITE_SUPABASE_URL=http://$SERVER_IP:$SUPABASE_API_PORT
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
VITE_SUPABASE_PROJECT_ID=local

SUPABASE_URL=http://$SERVER_IP:$SUPABASE_API_PORT
SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

PORT=$APP_PORT
HOST=0.0.0.0
NODE_ENV=production
EOF
  chmod 600 "$SOURCE_DIR/.env"
}

build_app() {
  log "bun install"
  ( cd "$SOURCE_DIR" && bun install --no-progress )
  log "bun run build"
  ( cd "$SOURCE_DIR" && bun run build )
  [ -d "$SOURCE_DIR/.output" ] || die "build did not produce .output/"
}

split_output() {
  log "splitting build → $FRONTEND_DIR (client) and $BACKEND_DIR (server)"
  rm -rf "$FRONTEND_DIR"/* "$BACKEND_DIR"/* || true
  if [ -d "$SOURCE_DIR/.output/public" ]; then
    rsync -a "$SOURCE_DIR/.output/public/" "$FRONTEND_DIR/"
  fi
  rsync -a --exclude='public' "$SOURCE_DIR/.output/" "$BACKEND_DIR/"
  cp -f "$SOURCE_DIR/.env" "$BACKEND_DIR/.env"
  ok "frontend: $(find "$FRONTEND_DIR" -type f | wc -l) files | backend: $(find "$BACKEND_DIR" -type f | wc -l) files"
}

start_pm2() {
  local entry=""
  for c in \
      "$BACKEND_DIR/server/index.mjs" \
      "$BACKEND_DIR/server/index.js"  \
      "$BACKEND_DIR/server.js"        \
      "$BACKEND_DIR/index.mjs"; do
    [ -f "$c" ] && { entry="$c"; break; }
  done
  [ -n "$entry" ] || entry=$(find "$BACKEND_DIR" -maxdepth 4 -type f \( -name 'index.mjs' -o -name 'index.js' -o -name 'server.mjs' \) | head -n1 || true)
  [ -n "$entry" ] || die "no server entry found in $BACKEND_DIR"
  ok "server entry: $entry"
  log "starting under PM2 (name=dlax, port=$APP_PORT)"
  PORT=$APP_PORT HOST=0.0.0.0 NODE_ENV=production \
    pm2 start "$entry" --name dlax --update-env --cwd "$BACKEND_DIR"
  pm2 save >/dev/null
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  pm2 status dlax || true
}

write_app_env
build_app
split_output
start_pm2

# =============================================================================
# 7) Summary
# =============================================================================
echo
printf '%s========================  DLAX is up  ========================%s\n' "$c_grn" "$c_rst"
printf '  App URL          : http://%s:%s\n'   "$SERVER_IP" "$APP_PORT"
printf '  Supabase API     : http://%s:%s\n'   "$SERVER_IP" "$SUPABASE_API_PORT"
printf '    dashboard user : %s\n'             "${DASHBOARD_USERNAME:-admin}"
printf '    dashboard pass : %s\n'             "${DASHBOARD_PASSWORD}"
printf '  Admin login      : %s   /   %s\n'    "$ADMIN_LOGIN_ID" "$ADMIN_PASSWORD"
printf '  Supabase secrets : %s/.env\n'        "$SUPA_DIR"
printf '  PM2              : pm2 status dlax  |  pm2 logs dlax\n'
printf '%s==============================================================%s\n' "$c_grn" "$c_rst"
echo
warn "Open ports $APP_PORT (app) and $SUPABASE_API_PORT (Supabase) in your firewall."
warn "CHANGE the admin password after first login."
