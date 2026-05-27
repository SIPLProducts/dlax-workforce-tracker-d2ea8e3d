#!/bin/bash
# v17.4 init: First-boot role bootstrap on a FRESH db volume only.
# Runs under the official postgres entrypoint as the postgres superuser
# (env $POSTGRES_USER defaults to postgres in the supabase image's init step).
# install.sh ALSO runs scripts/sync-roles.sh after the DB is healthy, so this
# script is best-effort — sync-roles.sh is the authoritative pass.
set -e

PW="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
DB="${POSTGRES_DB:-postgres}"

PW_ESCAPED="${PW//\'/\'\'}"

# Use the env vars psql picks up from the entrypoint (POSTGRES_USER/POSTGRES_DB).
psql -v ON_ERROR_STOP=1 -d "$DB" <<SQL
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
  END IF;
END \$\$;

GRANT anon, authenticated, service_role TO authenticator;
SQL

echo "[dlax init] role passwords synced with POSTGRES_PASSWORD"
