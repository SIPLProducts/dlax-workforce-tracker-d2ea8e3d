## Goal

On the **Project Assignments** screen (`/masters/assignments`), the **Project Coordinator (PC)** role should have exactly the same capabilities as Admin:

- Open the screen from the sidebar
- Pick any project
- Assign/unassign contractors, departments, categories (single + bulk)
- Auto-assign mapped categories when a department is added
- Create new contractor (via "Add & Assign" dialog) and create new department / category inline

No other role's behavior changes, and PC's access to the other master screens (Projects, Contractors, Departments, Categories master pages) stays exactly as it is today (hidden / no edit).

## Why a scoped change is needed

The current permission model would normally require granting PC `edit` on `masters_projects`, `masters_contractors`, `masters_departments`, and `masters_categories`. That would also surface those four master screens in the sidebar for PC — which we explicitly don't want.

So we'll scope the new access narrowly to the Assignments screen and the join tables it writes, by role rather than by screen permission.

## Changes

### 1. `src/hooks/use-permissions.tsx` — PC baseline
Add one line to the `project_coordinator` baseline so the Assignments screen is reachable and editable for PC:
```
masters_assignments: "edit"
```
No other baseline entries change. Sidebar already shows links based on `canView`, so PC will now see "Project Assignments" but still NOT see Projects / Contractors / Departments / Categories master screens.

### 2. `src/components/ProjectAssignments.tsx` — component-level gating
Currently:
```
const canCreate = canEdit(cfg.createPermScreen); // masters_contractors / _departments / _categories
const canAssign = canEdit("masters_projects");
```
Replace both checks with: admin OR project_coordinator OR existing `canEdit(...)`. Pull role from `useAuth()`. This keeps Supervisor / Manager / PM behavior unchanged and unlocks the same UI for PC that Admin sees, without touching unrelated screens.

### 3. RLS policies — allow PC to write on the assignment tables
Today the `Manage ...` policies on `project_contractors`, `project_departments`, `project_categories` only allow admin, `masters_projects` editors, or the master-screen editor + project access. Extend each policy's USING/WITH CHECK to also allow:
```
has_role(auth.uid(), 'project_coordinator') AND has_project_access(auth.uid(), project_id)
```
The matching SELECT policies will also be extended so PC can read the joins for their projects.

For "Add & Assign" (which inserts into the master table first), extend the `Manage` policies on `contractors`, `departments`, and `worker_categories` to also allow `has_role(auth.uid(), 'project_coordinator')`. PC still cannot reach those screens directly (sidebar/ScreenGuard hide them), but the insert from the Assignments dialog will succeed.

No changes to the `daily_manpower`, approvals, profiles, or any other tables.

### 4. Verify
After the migration:
- Sign in as PC → sidebar shows "Project Assignments" (and the screens PC already had); Projects/Contractors/Departments/Categories master pages remain hidden.
- On Assignments: project picker works; both "Add & Assign" flows work; checkbox toggle + "Select all" work; auto-assign categories runs on department assignment.
- Sign in as Supervisor / Manager / PM / a custom-role user → no change vs. today.
- Sign in as Admin → no change vs. today.

## Out of scope

- No data migration, no schema changes (only policy edits).
- No changes to Projects / Contractors / Departments / Categories master screens.
- No changes to Daily Entry, Approvals, Reports, or User Management.
- Earlier-discussed contractor/project duplicate cleanup is unrelated and not included here.
