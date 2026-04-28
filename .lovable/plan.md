## Plan

Fix the Daily Entry project dropdown so `prasad.kvvk` only sees the 4 assigned projects, even though the user has the admin role.

## What I found

- `prasad.kvvk` is an admin and has exactly 4 assigned projects: `BHELSTPP`, `IIPEVSKP`, `NLCHITES`, `UNITVSKP`.
- The backend access function already supports restricted admins.
- The likely issue is the `projects` table still has an admin management policy that allows admins to select all project rows, so the Daily Entry query `projects.select(*)` receives all active projects.

## Changes to make

1. Update the `projects` table SELECT access rule so project lists are filtered through `has_project_access(auth.uid(), id)` for all users, including admins with project assignments.
2. Keep admin create/update/delete access for projects intact.
3. Verify that `prasad.kvvk` resolves to exactly 4 projects through the same access logic used by Daily Entry.
4. No UI change is needed unless the dropdown still uses a bypass query after the policy fix.

## Technical details

Current conflict:
```text
projects SELECT policy = has_project_access(...)
projects ALL policy for admins = has_role(admin)
```

Because `ALL` includes SELECT, admin users can still read every project. I will replace the admin `ALL` policy with write-specific admin policies, so SELECT remains scoped by project access.

Target behavior:
```text
Admin with no project assignments -> all projects
Admin with project assignments -> assigned projects only
Supervisor/Manager -> assigned projects only
```