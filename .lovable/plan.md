# Fix: Newly created projects not visible in Projects screen

## Root cause
The `projects` table SELECT policy uses `has_project_access(auth.uid(), id)`. That function only grants admin/user-manager users access to **all** projects when they have **zero** rows in `user_projects`. As soon as an admin gets assigned to any specific project, they can no longer see projects they aren't explicitly linked to — including ones they just created. New projects are never auto-inserted into `user_projects`, so they disappear from the list right after creation (toast shows "Created", but the row is filtered out by RLS).

This matches what's happening in your screenshot: the DB has the new "DLAX Metro Phase 1" row, but the list only shows the 4 projects you're directly assigned to.

## Change

### 1. Migration — replace the SELECT policy on `public.projects`

Drop the existing "Users view assigned projects" SELECT policy and create:

```sql
CREATE POLICY "View projects"
ON public.projects FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_projects')
  OR has_project_access(auth.uid(), id)
);
```

Effect:
- **Admins** always see every project, regardless of `user_projects` assignments.
- **Users with edit access to the Projects master** see every project (needed to manage them).
- **Everyone else** keeps current per-user scoping via `user_projects`.

### 2. No code changes
`src/routes/masters.projects.tsx` already does `select("*")`. Once the policy is fixed, your newly created projects appear immediately.

## Out of scope
- `has_project_access` itself is not changed — Daily Entry, Reports, Approvals, and other operational screens stay scoped per user as today.
- No changes to insert/update/delete policies on `projects`.
- No schema changes, no new columns.
