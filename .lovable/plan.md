## Plan

1. **Fix backend table access for master data**
   - Add the missing Data API permissions for these existing public tables:
     - `departments`
     - `worker_categories`
     - `department_categories`
   - Keep access limited to logged-in users and service/backend code only.
   - Do **not** make these tables public/anonymous.

2. **Preserve current RLS rules**
   - Admins and users with the relevant master permissions can manage records.
   - Logged-in users can view departments/categories as currently intended.
   - No change to roles, project access, or screen permissions.

3. **Verify after approval**
   - Re-check permissions exist for the three tables.
   - Confirm the master screens can load newly created categories/departments instead of showing empty results.

## Technical detail

The rows are present in the database, but the permission check returned no Data API grants for `departments`, `worker_categories`, and `department_categories`. That can allow direct database inserts to exist while the app cannot read them correctly through the frontend API. The fix is a small migration with explicit grants, not a UI rewrite.