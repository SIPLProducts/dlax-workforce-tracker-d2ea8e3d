## Plan: Fix admin project visibility for `prasad`

### Current reason
`prasad` has role **admin**, and the current backend access rule says:

```text
admin = can access every project
```

So even if only 4 projects are assigned in User Management, the system still returns all projects because admin access is overriding the assignment list.

### Desired behavior
Keep `prasad` as **admin**, but if an admin has project assignments, restrict that admin to only those assigned projects.

New rule:

```text
Admin with no assigned projects  -> all projects
Admin with assigned projects     -> only assigned projects
Supervisor/Manager               -> only assigned projects
```

### Implementation steps

1. **Update backend project access rule**
   - Change the `has_project_access(user_id, project_id)` database function.
   - It will first check whether the user has explicit project assignments.
   - If assignments exist, only those projects are accessible.
   - If the user is admin and has no assignments, they keep full access.

2. **Keep role unchanged**
   - `prasad` remains **admin**.
   - No need to select “all projects”.
   - Only the 4 selected projects will be visible once assigned.

3. **Update User Management display**
   - In the users table, show clearer project scope text:
     - `All projects (admin)` for admins with no assigned projects.
     - `Restricted to 4 projects` for admins like `prasad`.
     - Normal assigned project count for non-admin users.

4. **Verify behavior**
   - Login as `prasad`.
   - Confirm Projects dropdowns, Daily Entry, Reports, and project master list only show the 4 assigned projects.
   - Confirm other admins with no assignments still see all projects.

### Technical details

Replace the current logic:

```sql
has_role(user, 'admin') OR explicit_project_assignment
```

with:

```sql
explicit_project_assignment
OR (
  has_role(user, 'admin')
  AND user_has_no_project_assignments
)
```

This keeps access control enforced in the backend, not only in the UI.