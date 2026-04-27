## Project-wise access for users

Today every signed-in user can see and work with **all projects**. You want to scope each user to one or more **assigned projects** so:
- A user assigned to "BHELSTPP" only sees BHELSTPP in dropdowns and reports.
- A user can be assigned to **multiple** projects (e.g. BHELSTPP + ED-KSK).
- Admins still see and manage everything.

### How it will work

**1. New table: `user_projects`** (many-to-many link)
- Columns: `user_id`, `project_id`, `created_at`.
- Unique on (user_id, project_id) so the same project can't be assigned twice.
- RLS: Admins manage all; users can read only their own assignments.

**2. Helper function `has_project_access(user_id, project_id)`**
- Returns true if the user is admin OR has the project in `user_projects`.
- Used in RLS policies and in the UI to filter dropdowns.

**3. Tighten RLS on data tables**
- `projects` SELECT: admin sees all, others see only assigned projects.
- `daily_manpower` SELECT/INSERT/UPDATE: must be for a project the user has access to.
- `worker_attendance` SELECT/INSERT/UPDATE: same rule.
- Admins keep full access; supervisors get insert/update only on their assigned projects.

**4. UI: Project assignment in User Management**
- New **"Projects"** action button on each user row (next to System / Custom).
- Opens a panel listing all projects with checkboxes — admin ticks the ones this user can access and clicks Save.
- Shows current assignments as badges in a new **"Projects"** column on the user table.

**5. UI: Auto-filtered project dropdowns**
- **Daily Entry** screen: project dropdown only lists assigned projects. If the user has exactly 1 project, it's pre-selected.
- **Reports** screen: project filter only lists assigned projects; "All projects" means "all my assigned projects".
- **Masters → Projects** stays admin-only (no change).

**6. Admins are unaffected**
- An admin user implicitly has access to every project — no rows needed in `user_projects`. The `has_project_access` function returns true for any project when the caller is admin.

### Migration safety
- Existing data is untouched. Until you assign projects to a non-admin user, that user will simply see no projects (dropdowns empty). You'll want to assign projects to existing supervisors/managers right after the migration — I'll surface a banner in User Management for users who have zero project assignments.

### Open questions

1. **Default behavior for managers (view-only role):** should they also be project-scoped? Default in this plan = **yes** (managers only see reports for their assigned projects). Say if you want managers to always see all projects.
2. **What about Daily Entry already-saved data?** A supervisor whose project access is later revoked won't see/edit those days anymore. Admins always can. OK?

### Files touched
- `supabase/migrations/<new>.sql` — `user_projects` table, `has_project_access` function, updated RLS policies
- `src/routes/users.tsx` — Projects column + assignment panel
- `src/routes/daily-entry.tsx` — filter project dropdown to assigned projects
- `src/routes/reports.tsx` — filter project dropdown to assigned projects
- `src/hooks/use-auth.tsx` *(optional)* — expose `accessibleProjectIds` for convenience
