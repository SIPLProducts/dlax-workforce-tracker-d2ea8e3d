## Diagnosis

Yes — this is a database permission issue in your self-hosted backend.

The login reaches the app, but after sign-in the frontend queries `public.user_roles` to load the logged-in user’s roles. PostgREST/Data API is returning:

```json
{
  "code": "42501",
  "message": "permission denied for table user_roles"
}
```

That means the SQL role `authenticated` does not have table-level `SELECT` permission on `public.user_roles`. RLS policies alone are not enough; self-hosted PostgREST also needs explicit `GRANT`s.

## Migration to apply

Create and apply a new SQL migration in your self-hosted project, for example:

```sql
-- Fix Data API access for user_roles on self-hosted PostgREST

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
```

## If your installer migration folder is used

Add it as a new file under your local migrations folder, for example:

```bash
supabase/migrations/20260605000100_fix_user_roles_data_api_grants.sql
```

Then rerun your installer/migration command.

## Direct psql apply option

If you are applying directly on the server:

```bash
cat > /tmp/fix_user_roles_grants.sql <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/fix_user_roles_grants.sql
```

If you connect inside the DB container instead, use your existing self-hosted command style, but the SQL above is the important part.

## Verification query

After applying, run:

```sql
SELECT
  has_table_privilege('authenticated', 'public.user_roles', 'SELECT') AS authenticated_can_select,
  has_table_privilege('service_role', 'public.user_roles', 'SELECT') AS service_role_can_select;
```

Expected result:

```text
authenticated_can_select | service_role_can_select
-------------------------+------------------------
t                       | t
```

## After applying

1. Reload/restart PostgREST or rerun your installer’s schema-cache reload step.
2. Clear browser site storage or open a private window.
3. Try login again.

If you still get `permission denied`, the next thing to check is whether the self-hosted PostgREST container is connecting with the correct `authenticator` role and has `GRANT authenticated TO authenticator;`.