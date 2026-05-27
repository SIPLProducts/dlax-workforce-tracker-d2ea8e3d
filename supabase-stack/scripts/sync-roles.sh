#!/usr/bin/env bash
# v17.4: Authoritative role-password sync.
# Connects as the LOCAL postgres OS user inside the dlax-db container,
# using peer/trust auth on the unix socket. This means we do NOT need
# to know any existing role password to repair things — perfect for
# recovering an existing volume whose role passwords are out of sync.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found"; exit 1
fi
# shellcheck disable=SC1091
set -a; source .env; set +a

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD missing from .env}"
: "${POSTGRES_DB:=postgres}"

PW_ESCAPED="${POSTGRES_PASSWORD//\'/\'\'}"

echo "[sync-roles] aligning Supabase service-role passwords with POSTGRES_PASSWORD"

# Run psql inside the container as the postgres OS user, over the local
# unix socket. The supabase/postgres image's pg_hba.conf allows local
# socket logins for the postgres superuser without a password.
docker exec -i --user postgres dlax-db \
  psql -v ON_ERROR_STOP=1 -U postgres -d "$POSTGRES_DB" <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN
    ALTER ROLE authenticator WITH LOGIN NOINHERIT PASSWORD '${PW_ESCAPED}';
  ELSE
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${PW_ESCAPED}';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN
    ALTER ROLE supabase_auth_admin WITH LOGIN CREATEROLE PASSWORD '${PW_ESCAPED}';
  ELSE
    CREATE ROLE supabase_auth_admin LOGIN CREATEROLE PASSWORD '${PW_ESCAPED}';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_storage_admin') THEN
    ALTER ROLE supabase_storage_admin WITH LOGIN CREATEROLE PASSWORD '${PW_ESCAPED}';
  ELSE
    CREATE ROLE supabase_storage_admin LOGIN CREATEROLE PASSWORD '${PW_ESCAPED}';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN
    ALTER ROLE supabase_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS PASSWORD '${PW_ESCAPED}';
  ELSE
    CREATE ROLE supabase_admin LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS PASSWORD '${PW_ESCAPED}';
  END IF;
END \$\$;

GRANT anon, authenticated, service_role TO authenticator;

-- Do NOT pre-create auth/storage schemas. gotrue/storage own them and
-- pre-creating desyncs their migration trackers.
SQL

echo "[sync-roles] passwords aligned"

# Verify by logging in as supabase_auth_admin via TCP using the new password.
if docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" dlax-db \
     psql -h 127.0.0.1 -U supabase_auth_admin -d "$POSTGRES_DB" -c 'select 1' >/dev/null 2>&1; then
  echo "[sync-roles] verified: supabase_auth_admin can log in"
else
  echo "[sync-roles] WARNING: supabase_auth_admin login test FAILED"
  exit 1
fi
