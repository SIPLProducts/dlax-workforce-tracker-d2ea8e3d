#!/usr/bin/env bash
# DLAX self-host installer v17.4.0
# Studio-only mode: brings up Postgres + Auth + REST + Meta + Studio + Kong.
# Does NOT run any DLAX application migrations or seed data.

set -euo pipefail

VERSION="17.4.0"
LOG=/var/log/dlax-install.log
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

YES=0
STUDIO_ONLY=0
RESET_CONFIG=0

for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    --studio-only) STUDIO_ONLY=1 ;;
    --reset-config) RESET_CONFIG=1 ;;
    *) echo "unknown flag: $arg"; exit 2 ;;
  esac
done

cd "$(dirname "$0")"
ROOT="$(pwd)"
echo "[dlax v$VERSION] root: $ROOT  studio_only=$STUDIO_ONLY  yes=$YES"

# --- .env handling ----------------------------------------------------------
if [[ $RESET_CONFIG -eq 1 || ! -f .env ]]; then
  cp .env.example .env
  echo "[dlax] wrote fresh .env from .env.example"
fi

chmod +x volumes/db/init/*.sh 2>/dev/null || true
chmod +x scripts/*.sh 2>/dev/null || true

command -v docker >/dev/null || { echo "ERROR: docker not installed"; exit 1; }
docker compose version >/dev/null || { echo "ERROR: docker compose v2 plugin not installed"; exit 1; }

# --- preflight: detect stale broken volume from previous installs ----------
if docker volume inspect dlax-supabase_db-data >/dev/null 2>&1; then
  echo "[dlax] note: existing dlax-supabase_db-data volume detected."
  echo "       sync-roles.sh will repair role passwords in place using local"
  echo "       socket auth — no existing password is required."
  echo "       If install still fails, run:"
  echo "         sudo bash scripts/reset-db-volume.sh && sudo bash install.sh --yes --studio-only"
fi

echo "[dlax] pulling images"
docker compose pull

echo "[dlax] starting db"
docker compose up -d db

echo "[dlax] waiting for db to become healthy"
status=starting
for i in $(seq 1 60); do
  status=$(docker inspect --format='{{.State.Health.Status}}' dlax-db 2>/dev/null || echo starting)
  [[ "$status" == "healthy" ]] && break
  sleep 2
done
[[ "$status" == "healthy" ]] || { echo "ERROR: db did not become healthy"; docker logs --tail=80 dlax-db; exit 1; }

# --- AUTHORITATIVE role-password sync (works on fresh OR existing volume) --
echo "[dlax] syncing service-role passwords with POSTGRES_PASSWORD"
bash scripts/sync-roles.sh

echo "[dlax] starting remaining services"
docker compose up -d auth rest meta kong studio

echo "[dlax] waiting for auth (gotrue) to settle"
ok=0
for i in $(seq 1 30); do
  if docker logs --tail=50 dlax-auth 2>&1 | grep -q "GoTrue API started"; then
    ok=1; break
  fi
  if docker logs --tail=50 dlax-auth 2>&1 | grep -q '"level":"fatal"'; then
    echo "ERROR: dlax-auth failed to start. Recent logs:"
    docker logs --tail=80 dlax-auth
    echo ""
    echo "Troubleshooting:"
    echo "  docker exec -it --user postgres dlax-db psql -U postgres -d postgres -c \"\\du\""
    echo "  docker logs --tail=200 dlax-db"
    echo "  sudo bash scripts/sync-roles.sh"
    echo "  sudo bash scripts/reset-db-volume.sh && sudo bash install.sh --yes --studio-only"
    exit 1
  fi
  sleep 2
done
[[ $ok -eq 1 ]] || echo "[warn] auth did not print 'GoTrue API started' yet — check: docker logs -f dlax-auth"

echo ""
echo "=============================================================="
echo " DLAX self-host stack is up (v$VERSION, studio-only mode)"
echo "=============================================================="
echo " Studio:   http://<server>:$(grep ^STUDIO_PORT .env | cut -d= -f2)"
echo " API/Kong: http://<server>:$(grep ^KONG_HTTP_PORT .env | cut -d= -f2)"
echo ""
echo " Studio login user: $(grep ^DASHBOARD_USERNAME .env | cut -d= -f2)"
echo " Studio login pass: (see DASHBOARD_PASSWORD in .env)"
echo ""
echo " NEXT STEPS — apply DLAX schema manually:"
echo "   1) Open Studio in your browser and log in."
echo "   2) Go to SQL Editor."
echo "   3) Paste and run your DLAX migrations one by one."
echo "   4) Then paste and run your seed SQL."
echo ""
echo " Useful commands:"
echo "   docker compose ps"
echo "   docker logs -f dlax-auth"
echo "   docker logs -f dlax-db"
echo "   sudo bash scripts/sync-roles.sh         # re-sync role passwords"
echo "   sudo bash scripts/reset-db-volume.sh    # destroys DB volume"
echo "=============================================================="
