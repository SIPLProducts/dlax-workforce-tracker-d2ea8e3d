The incognito test proves this is not a stale browser token anymore. The current error is a database permission issue on the self-hosted deployment: PostgREST is logged in, but the `authenticated` database role has not been granted table privileges for `user_custom_roles`.

Plan:

1. Add explicit Data API grants for the affected auth/role tables
   - Grant `authenticated` access to `user_custom_roles`.
   - Also grant the same required privileges to related tables used immediately after login: `user_roles`, `custom_roles`, `role_screen_permissions`, `profiles`, and `user_projects`.
   - Grant `service_role` access too, so admin/server operations continue working.

2. Keep RLS policies unchanged
   - These grants only allow PostgREST to reach the tables.
   - Existing RLS policies still decide which rows each user can actually read or manage.

3. Apply the SQL on your self-hosted server
   - Since the failing URL is `http://15.206.37.230:8000`, this needs to be applied to that server’s database, not only this Lovable Cloud preview backend.
   - I will provide the exact SQL and Docker command to run against your deployed database.

4. Verify login again
   - Open incognito and log in again.
   - Expected result: no `42501 permission denied for table user_custom_roles` response.

SQL to apply:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_custom_roles TO authenticated;
GRANT ALL ON TABLE public.user_custom_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_roles TO authenticated;
GRANT ALL ON TABLE public.custom_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_screen_permissions TO authenticated;
GRANT ALL ON TABLE public.role_screen_permissions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_projects TO authenticated;
GRANT ALL ON TABLE public.user_projects TO service_role;
```

After approval, I’ll give you the exact copy-paste command for your server setup.