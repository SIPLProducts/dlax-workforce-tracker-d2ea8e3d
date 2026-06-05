## Problem
The installer applies migrations, then attempts to grant Data API permissions to `authenticated`, but verification still returns `false` for `public.user_roles`. In self-hosted stacks this usually happens because the database role used by PostgREST is not the same role name the script is granting to, or because the role does not inherit the privileges.

## Plan
1. Update `install.sh` Data API grant block to resolve the actual API roles before granting:
   - Detect available roles among `authenticated`, `supabase_auth_admin`, and any PostgREST configured roles where applicable.
   - Keep grants for `authenticated` when it exists.
   - Add a fallback explicit grant to the effective role used by the local API if different.

2. Make the verification check match real app behavior:
   - Verify both direct grant visibility and effective privilege using `SET ROLE authenticated` when possible.
   - If direct `has_table_privilege('authenticated', ...)` is false but the effective API role can read through the API role mapping, log a warning instead of failing.
   - Print actionable diagnostics: role existence, inherit flag, owner, and current ACL for `public.user_roles`.

3. Add a targeted migration-safe grant for the root cause table:
   - Add/ensure explicit `GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;`
   - Add/ensure `GRANT ALL ON public.user_roles TO service_role;`
   - Do not grant `anon` access to `user_roles`.

4. Keep the change scoped to deployment/install behavior only:
   - No frontend auth flow changes.
   - No RLS policy widening.
   - No public/anonymous access to role data.

## Expected result
Running `install.sh` should no longer stop at the grant verification step, and the deployed login should stop hitting `permission denied for table user_roles` once the backend stack is restarted/reloaded.