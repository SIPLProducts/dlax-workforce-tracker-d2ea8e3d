## Cause

The request URL and response confirm this is not a frontend URL issue. The insert reaches PostgREST, but the database rejects it because the `daily_manpower` INSERT RLS policy fails.

The current insert policy depends on:

```sql
public.has_project_access(auth.uid(), project_id)
```

Your existing `has_project_access` function only gives admin/user-management users all-project access when they have **no rows** in `user_projects`. If the admin account has even one assigned project but not the selected project, `has_project_access` returns `false`, so saving `daily_manpower` fails with:

```json
{
  "code": "42501",
  "message": "new row violates row-level security policy for table \"daily_manpower\""
}
```

## Fix

Update the database function `public.has_project_access` so:

- Admin users always have access to all projects.
- Users with `user_management` edit access keep all-project access.
- Non-admin/non-user-management users remain scoped only to projects assigned in `user_projects`.

New function logic:

```sql
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_screen_edit(_user_id, 'user_management')
    OR EXISTS (
      SELECT 1
      FROM public.user_projects
      WHERE user_id = _user_id
        AND project_id = _project_id
    );
$$;
```

## Why this is safe

This does not open access to normal users. It only restores expected global access for admin/user-management users. Existing RLS policies for `daily_manpower`, `worker_attendance`, project assignments, and sheets will automatically use the corrected function.

## Self-hosted SQL to run

Run this in your self-hosted database using `psql` inside the `dlax-db` container:

```bash
docker exec -i dlax-db psql -U postgres -d postgres <<'SQL'
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_screen_edit(_user_id, 'user_management')
    OR EXISTS (
      SELECT 1
      FROM public.user_projects
      WHERE user_id = _user_id
        AND project_id = _project_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
SQL
```

## Verify

1. Refresh the app.
2. Open Daily Entry for the same project/date.
3. Click Save.
4. The RLS error should be gone.
5. Also test OT Entry because it uses similar project-access logic.