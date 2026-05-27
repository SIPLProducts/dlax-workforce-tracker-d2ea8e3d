#!/usr/bin/env bash
# =============================================================================
# DLAX one-shot deployer
#   - Self-hosted Supabase (Docker)
#   - DLAX TanStack app (frontend assets + Node SSR backend)
#   - Schema migrations + seeded admin user
#
# Layout you copy to the server BEFORE running this script:
#   /root/DLAX/
#     deploy.sh             <- this file
#     source/               <- the DLAX Lovable project (src/, supabase/, package.json, ...)
#     supabase-stack/       <- the v17 self-host bundle (docker-compose.yml, volumes/, scripts/, .env.example)
#
# Run:    sudo bash /root/DLAX/deploy.sh
# Reset:  sudo bash /root/DLAX/deploy.sh --reset
# App only: sudo bash /root/DLAX/deploy.sh --rebuild-app
# =============================================================================
set -Eeuo pipefail

# ---------- config (override via env) ----------------------------------------
DLAX_ROOT="${DLAX_ROOT:-/root/DLAX}"
SOURCE_DIR="${SOURCE_DIR:-$DLAX_ROOT/source}"
SUPA_DIR="${SUPA_DIR:-$DLAX_ROOT/supabase-stack}"
FRONTEND_DIR="$DLAX_ROOT/frontend"
BACKEND_DIR="$DLAX_ROOT/backend"

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

# ---------- args --------------------------------------------------------------
MODE_RESET=0
MODE_APP_ONLY=0
for a in "$@"; do
  case "$a" in
    --reset)        MODE_RESET=1 ;;
    --rebuild-app)  MODE_APP_ONLY=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *) die "unknown arg: $a" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || die "run as root (sudo bash $0)"
[ -d "$SOURCE_DIR" ] || die "missing $SOURCE_DIR (copy the DLAX project there)"
[ -d "$SUPA_DIR" ]   || die "missing $SUPA_DIR (copy the v17 supabase-stack there)"

mkdir -p "$FRONTEND_DIR" "$BACKEND_DIR"

# =============================================================================
# 1) Preflight: install dependencies (idempotent)
# =============================================================================
install_pkgs() {
  log "preflight: apt packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null
  apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg lsb-release jq openssl git rsync uuid-runtime >/dev/null
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

if [ "$MODE_APP_ONLY" -eq 0 ]; then
  install_pkgs
  install_docker
fi
install_node_bun

# =============================================================================
# 2) Optional --reset
# =============================================================================
if [ "$MODE_RESET" -eq 1 ]; then
  warn "--reset: stopping containers, wiping volumes and built artifacts"
  ( cd "$SUPA_DIR" && docker compose down -v --remove-orphans || true )
  rm -rf "$FRONTEND_DIR"/* "$BACKEND_DIR"/* "$SOURCE_DIR/.output" "$SOURCE_DIR/node_modules" || true
  pm2 delete dlax >/dev/null 2>&1 || true
  ok "reset complete"
fi

# =============================================================================
# 3) Bring up self-hosted Supabase (skipped on --rebuild-app)
# =============================================================================
b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }

# Build a Supabase-compatible JWT (HS256) from JWT_SECRET for role=anon|service_role
mint_jwt() {
  local role="$1" secret="$2"
  local iat exp header payload sig
  iat=$(date +%s)
  exp=$((iat + 60*60*24*365*10))   # 10 years
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%d,"exp":%d}' "$role" "$iat" "$exp" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" \
        | openssl dgst -binary -sha256 -hmac "$secret" | b64url)
  printf '%s.%s.%s\n' "$header" "$payload" "$sig"
}

ensure_supabase_env() {
  local envf="$SUPA_DIR/.env"
  if [ ! -f "$envf" ]; then
    log "generating Supabase .env"
    local pg_pass jwt_secret anon srk dash_pass
    pg_pass=$(openssl rand -hex 24)
    jwt_secret=$(openssl rand -hex 32)
    dash_pass=$(openssl rand -hex 12)
    anon=$(mint_jwt anon "$jwt_secret")
    srk=$(mint_jwt service_role "$jwt_secret")
    cat > "$envf" <<EOF
# Generated by deploy.sh on $(date -u +%FT%TZ)
POSTGRES_PASSWORD=$pg_pass
JWT_SECRET=$jwt_secret
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

DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false
JWT_EXPIRY=3600
EOF
    chmod 600 "$envf"
    ok "wrote $envf (keep this file safe)"
  else
    ok "reusing existing $envf"
  fi
}

start_supabase() {
  log "starting Supabase stack"
  ( cd "$SUPA_DIR" && docker compose up -d )
  log "waiting for db to become healthy"
  for i in $(seq 1 120); do
    state=$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo starting)
    [ "$state" = "healthy" ] && { ok "db healthy"; break; }
    sleep 2
    [ "$i" = 120 ] && die "db never became healthy. Try: cd $SUPA_DIR && docker compose logs db"
  done
  log "waiting for Kong/REST API on :$SUPABASE_API_PORT"
  for i in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$SUPABASE_API_PORT/auth/v1/health" >/dev/null 2>&1 \
       || curl -fsS "http://127.0.0.1:$SUPABASE_API_PORT/" >/dev/null 2>&1; then
      ok "API up"; return
    fi
    sleep 2
  done
  warn "API did not respond on /auth/v1/health within 120s — continuing; check 'docker compose ps'"
}

if [ "$MODE_APP_ONLY" -eq 0 ]; then
  ensure_supabase_env
  start_supabase
fi

# Load env vars from supabase .env for the rest of the script
set -a
# shellcheck disable=SC1091
. "$SUPA_DIR/.env"
set +a

# =============================================================================
# 4) Apply DLAX migrations + seed admin
# =============================================================================
apply_migrations() {
  local mdir="$SOURCE_DIR/supabase/migrations"
  [ -d "$mdir" ] || { warn "no migrations folder at $mdir — skipping schema"; return; }
  log "applying migrations from $mdir"
  # Copy into the db container so psql can read them
  docker exec "$DB_CONTAINER" mkdir -p /tmp/dlax-mig
  docker exec "$DB_CONTAINER" sh -c 'rm -f /tmp/dlax-mig/*.sql'
  for f in $(ls "$mdir"/*.sql 2>/dev/null | sort); do
    base=$(basename "$f")
    docker cp "$f" "$DB_CONTAINER:/tmp/dlax-mig/$base" >/dev/null
    log "  -> $base"
    # Run as superuser via local socket (peer auth) — survives unknown role passwords
    if ! docker exec --user postgres "$DB_CONTAINER" \
        psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/tmp/dlax-mig/$base" >/dev/null; then
      die "migration $base failed. See: docker logs $DB_CONTAINER"
    fi
  done
  ok "migrations applied"
}

seed_admin() {
  log "seeding admin user ($ADMIN_LOGIN_ID / $ADMIN_EMAIL)"
  # If a user with this email already exists, skip
  local exists
  exists=$(docker exec --user postgres "$DB_CONTAINER" \
    psql -tAU postgres -d postgres -c \
    "SELECT 1 FROM auth.users WHERE email=lower('$ADMIN_EMAIL') LIMIT 1;" 2>/dev/null || echo "")
  if [ "$exists" = "1" ]; then
    ok "admin already exists — skipping create"
    return
  fi
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
    rm -f "$resp"
    die "could not create admin via auth admin API"
  fi
  rm -f "$resp"
  # handle_new_user() trigger promotes first user to admin and creates profile.login_id
  ok "admin user created"
}

apply_migrations
seed_admin

# =============================================================================
# 5) Build DLAX app
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
  log "installing app dependencies (bun install)"
  ( cd "$SOURCE_DIR" && bun install --no-progress )
  log "building app (bun run build)"
  ( cd "$SOURCE_DIR" && bun run build )
  [ -d "$SOURCE_DIR/.output" ] || die "build did not produce .output/ — check 'bun run build' logs"
}

split_output() {
  log "splitting build into $FRONTEND_DIR (client) and $BACKEND_DIR (server)"
  rm -rf "$FRONTEND_DIR"/* "$BACKEND_DIR"/* || true
  # client/static assets -> frontend
  if [ -d "$SOURCE_DIR/.output/public" ]; then
    rsync -a "$SOURCE_DIR/.output/public/" "$FRONTEND_DIR/"
  fi
  # everything else (server entry + node deps) -> backend
  rsync -a --exclude='public' "$SOURCE_DIR/.output/" "$BACKEND_DIR/"
  cp -f "$SOURCE_DIR/.env" "$BACKEND_DIR/.env"
  ok "frontend: $(find "$FRONTEND_DIR" -type f | wc -l) files"
  ok "backend:  $(find "$BACKEND_DIR"  -type f | wc -l) files"
}

start_pm2() {
  # Locate the server entry produced by TanStack Start
  local entry=""
  for c in \
      "$BACKEND_DIR/server/index.mjs" \
      "$BACKEND_DIR/server/index.js"  \
      "$BACKEND_DIR/server.js"        \
      "$BACKEND_DIR/index.mjs"; do
    [ -f "$c" ] && { entry="$c"; break; }
  done
  if [ -z "$entry" ]; then
    warn "couldn't find Node server entry under $BACKEND_DIR — searching..."
    entry=$(find "$BACKEND_DIR" -maxdepth 4 -type f \( -name 'index.mjs' -o -name 'index.js' -o -name 'server.mjs' \) | head -n1 || true)
  fi
  [ -n "$entry" ] || die "no server entry found in $BACKEND_DIR; inspect the .output structure"
  ok "server entry: $entry"

  log "starting under PM2 (name=dlax, port=$APP_PORT)"
  pm2 delete dlax >/dev/null 2>&1 || true
  PORT=$APP_PORT HOST=0.0.0.0 NODE_ENV=production \
    pm2 start "$entry" --name dlax --update-env --cwd "$BACKEND_DIR"
  pm2 save >/dev/null
  # systemd auto-start (idempotent)
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  ok "pm2 status:"; pm2 status dlax || true
}

write_app_env
build_app
split_output
start_pm2

# =============================================================================
# 6) Summary
# =============================================================================
echo
printf '%s========================  DLAX is up  ========================%s\n' "$c_grn" "$c_rst"
printf '  App URL          : http://%s:%s\n'        "$SERVER_IP" "$APP_PORT"
printf '  Supabase Studio  : http://%s:%s\n'        "$SERVER_IP" "$SUPABASE_API_PORT"
printf '    dashboard user : %s\n'                  "${DASHBOARD_USERNAME:-admin}"
printf '    dashboard pass : %s\n'                  "${DASHBOARD_PASSWORD:-(see $SUPA_DIR/.env)}"
printf '  Admin login (app): %s   /   %s\n'         "$ADMIN_LOGIN_ID" "$ADMIN_PASSWORD"
printf '  Frontend assets  : %s\n'                  "$FRONTEND_DIR"
printf '  Backend (SSR)    : %s\n'                  "$BACKEND_DIR"
printf '  Supabase secrets : %s/.env\n'             "$SUPA_DIR"
printf '  PM2              : pm2 status dlax  |  pm2 logs dlax\n'
printf '%s==============================================================%s\n' "$c_grn" "$c_rst"
echo
warn "Open ports $APP_PORT (app) and $SUPABASE_API_PORT (Supabase) in your firewall / cloud SG."
warn "CHANGE the admin password after first login."
