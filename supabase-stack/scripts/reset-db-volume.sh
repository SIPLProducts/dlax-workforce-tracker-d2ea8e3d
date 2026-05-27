#!/usr/bin/env bash
# v17.4: Destroy local DB + storage volumes so the next install starts truly
# fresh. Use this if a previous (broken) install left a half-initialized DB.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[reset-db-volume] stopping stack"
docker compose down --remove-orphans || true

for VOL in dlax-supabase_db-data dlax-supabase_storage-data; do
  echo "[reset-db-volume] removing volume: $VOL"
  docker volume rm -f "$VOL" || true
done

echo "[reset-db-volume] done. Run: sudo bash install.sh --yes --studio-only"
