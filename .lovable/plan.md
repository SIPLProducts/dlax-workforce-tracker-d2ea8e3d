## Problem

On the self-hosted deploy, `signInWithUserId` succeeds (toast shows "Logged in successfully"), but the very next query — `fetchRoles()` against `public.user_roles` — returns:

```
{ "code": "42501", "message": "permission denied for table user_roles" }
```

With no roles loaded and follow-on RLS-gated reads (`profiles`, `user_custom_roles`, `role_screen_permissions`, `daily_manpower_sheets`, …) also failing, `usePermissions` resolves to `none`, AuthGuard/route guards treat the session as unusable, and the app bounces back to `/login`.

## Root cause

Supabase hosted projects ship with implicit Data-API grants on `public.*` to `anon`, `authenticated`, and `service_role`. Self-hosted Supabase (what `install.sh` brings up) does NOT. Our migrations only `ENABLE RLS` + `CREATE POLICY`; none of them issue `GRANT`. So on a fresh self-hosted DB, PostgREST has RLS policies that would allow the row, but no table-level privilege to even reach it → 42501.

This affects every table in `public` (user_roles, profiles, projects, daily_manpower, …), not just `user_roles`.

## Fix (one-file change: `install.sh`)

After step 5 ("apply migrations") and BEFORE the PostgREST reload, add a "Data API grants" step that:

1. Sets default privileges so future objects created by `postgres` automatically grant to the API roles:
   ```sql
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT ALL ON TABLES TO service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT EXECUTE ON FUNCTIONS TO authenticated, anon, service_role;
   ```
2. Backfills grants on every existing base table in `public`:
   ```sql
   DO $$
   DECLARE t record;
   BEGIN
     FOR t IN SELECT c.relname FROM pg_class c
              JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE c.relkind='r' AND n.nspname='public'
     LOOP
       EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
       EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
     END LOOP;
   END $$;
   GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
   GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
   ```
   Deliberately not granting `anon` on tables — every policy in this app is `auth.uid()`-scoped, and `anon` only needs `EXECUTE` on the `get_email_for_login_id` RPC (covered by the function grant above).

3. Then the existing `NOTIFY pgrst, 'reload schema'` + `docker restart dlax-rest` already in install.sh picks up the new privileges.

## Verification (added to install.sh after grants)

Quick sanity check before declaring success:
```bash
docker exec --user postgres "$DB_CONTAINER" psql -tAU postgres -d postgres -c \
  "SELECT has_table_privilege('authenticated','public.user_roles','SELECT');"
```
Expect `t`. If not, fail the install with a clear message.

## Out of scope

- No app code changes. `use-auth`, `AuthGuard`, login flow stay as-is.
- No migration file changes (we don't want to mutate historical migrations; the install-time backfill covers fresh and upgraded DBs).
- No grants in `auth`/`storage` schemas (Supabase-managed).

## After you pull and rerun

```bash
sudo bash install.sh
```
The redirect-after-login symptom should disappear because `user_roles` (and every other public table) is now reachable through PostgREST with RLS enforced.
