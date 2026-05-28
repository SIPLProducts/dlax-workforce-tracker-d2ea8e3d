#!/bin/bash
# v17.4 init: First-boot role + schema bootstrap on a FRESH db volume only.
set -e

PW="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
DB="${POSTGRES_DB:-postgres}"
PW_ESC="${PW//\'/\'\'}"

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-supabase_admin}" -d "$DB" <<SQL
-- Roles ---------------------------------------------------------------------
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='postgres') THEN
    CREATE ROLE postgres LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS PASSWORD '${PW_ESC}';
  END IF;
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
    ALTER ROLE authenticator WITH LOGIN NOINHERIT PASSWORD '${PW_ESC}';
  ELSE
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${PW_ESC}';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN
    ALTER ROLE supabase_auth_admin WITH LOGIN CREATEROLE PASSWORD '${PW_ESC}';
  ELSE
    CREATE ROLE supabase_auth_admin LOGIN CREATEROLE PASSWORD '${PW_ESC}';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_storage_admin') THEN
    ALTER ROLE supabase_storage_admin WITH LOGIN CREATEROLE PASSWORD '${PW_ESC}';
  ELSE
    CREATE ROLE supabase_storage_admin LOGIN CREATEROLE PASSWORD '${PW_ESC}';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN
    ALTER ROLE supabase_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS PASSWORD '${PW_ESC}';
  END IF;
END \$\$;

GRANT anon, authenticated, service_role TO authenticator;

-- Schemas that GoTrue + Storage migrations need on a FRESH volume ----------
CREATE SCHEMA IF NOT EXISTS auth    AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;

GRANT ALL ON DATABASE postgres TO postgres, supabase_auth_admin, supabase_storage_admin;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA auth    TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER ROLE supabase_auth_admin    SET search_path = auth, public;
ALTER ROLE supabase_storage_admin SET search_path = storage, public;

-- Realtime publication (empty; app migrations ADD TABLE into it) -----------
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END \$\$;
SQL

echo "[dlax init] roles + schemas ready"
