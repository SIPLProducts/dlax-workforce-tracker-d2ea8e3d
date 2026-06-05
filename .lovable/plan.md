## Issue

Self-hosted PostgREST returns `42501 permission denied` for `public.user_projects` (and will for every other table) because the `authenticated` and `anon` roles have no table-level `GRANT`s on the `public` schema. RLS alone is not enough.

We already fixed `user_roles`. Instead of patching one table at a time, apply grants across all current and future tables in `public`.

## Migration to apply

Create `supabase/migrations/20260605000200_fix_public_schema_data_api_grants.sql` with:

```sql
-- Ensure roles can use the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant table privileges on every existing base table in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tname);
  END LOOP;
END $$;

-- Sequences (needed for INSERTs that use serial/identity)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Functions (RPCs like get_email_for_login_id, has_role, approve_sheet, etc.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Future objects created in public inherit the same grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Make sure PostgREST's login role can assume the API roles
GRANT anon, authenticated, service_role TO authenticator;
```

Notes on scope:
- `anon` intentionally gets **no** table SELECT — every RLS policy in this app scopes to `auth.uid()`, so anonymous reads should stay blocked. Login itself uses the `get_email_for_login_id` RPC, which is covered by the function grant above.
- RLS is unchanged. Tables that don't yet have policies remain locked from the client; `service_role` (edge code) still works because it bypasses RLS.

## How to apply on the self-hosted server

```bash
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < 20260605000200_fix_public_schema_data_api_grants.sql

# Reload PostgREST schema cache
docker kill -s SIGUSR1 dlax-rest 2>/dev/null || docker restart dlax-rest
```

## Verification

```sql
SELECT table_name,
       has_table_privilege('authenticated', 'public.'||table_name, 'SELECT') AS auth_select
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
```
All rows should show `auth_select = t`. Then clear browser storage and log in again.

## Deliverable

On approval I will:
1. Write the SQL file to `supabase/migrations/20260605000200_fix_public_schema_data_api_grants.sql`
2. Also save a copy to `/mnt/documents/` so you can download and run it on the self-hosted DB.
