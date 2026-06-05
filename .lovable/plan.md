## Issue

Self-hosted Postgres returns `42501 permission denied for schema auth` when saving a daily entry sheet.

The save inserts into `public.daily_manpower`. RLS policies and the `set_daily_manpower_initial_status` trigger evaluate `auth.uid()` (and indirectly `auth.role()` / `auth.jwt()`) **as the calling role** (`authenticated`) — not as a SECURITY DEFINER. On hosted Supabase the `authenticated` and `anon` roles already have `USAGE` on `schema auth` and `EXECUTE` on these helpers; on your self-hosted DB those grants are missing, so every RLS check that touches `auth.uid()` fails with this error.

This is the same class of issue as the earlier `public` GRANT fix, but for the `auth` schema's helper functions (NOT its tables — we must NOT grant access to `auth.users`, etc.).

## Migration to apply

Create `supabase/migrations/20260605000400_grant_auth_helpers_to_api_roles.sql`:

```sql
-- Let API roles resolve objects in the auth schema (needed to call auth.uid() etc.)
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Execute the JWT helper functions used by RLS policies and triggers
GRANT EXECUTE ON FUNCTION auth.uid()  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt()  TO anon, authenticated, service_role;

-- Future helper functions added to the auth schema inherit EXECUTE
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
```

Notes:
- We do **not** grant any table privileges on `auth.*`. `auth.users` and friends stay locked. Only the helper functions become callable, which is what hosted Supabase already does by default.
- Nothing in `public` changes; RLS rules are unchanged.

## How to apply on the self-hosted server

```bash
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < 20260605000400_grant_auth_helpers_to_api_roles.sql

# Reload PostgREST schema cache
docker kill -s SIGUSR1 dlax-rest 2>/dev/null || docker restart dlax-rest
```

## Verification

```sql
SELECT has_schema_privilege('authenticated', 'auth', 'USAGE')         AS auth_usage,
       has_function_privilege('authenticated', 'auth.uid()', 'EXECUTE') AS uid_exec,
       has_function_privilege('authenticated', 'auth.role()', 'EXECUTE') AS role_exec,
       has_function_privilege('authenticated', 'auth.jwt()', 'EXECUTE')  AS jwt_exec;
```
All four should be `t`. Then retry saving a daily entry sheet — the `42501` should be gone.

## Deliverable

On approval I will:
1. Write the SQL to `supabase/migrations/20260605000400_grant_auth_helpers_to_api_roles.sql` (also runs against Lovable Cloud through the migration tool).
2. Save a copy to `/mnt/documents/` for you to download and run on the self-hosted DB.
