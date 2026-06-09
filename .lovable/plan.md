## Goal
On the Project Assignments screen, any user whose role (built-in or custom) has **edit** permission on `masters_assignments` gets the same capabilities as Admin: Add & Assign (with inline-create of contractors / departments / categories), bulk select, toggle on/off, auto-assign categories. No changes to Supervisor, Manager, or any role without edit on this screen.

## Why the previous change didn't take effect
The earlier fix gated PC features on `hasRole("project_coordinator")` (the built-in system role). In your database, **no user holds that system role** — every Project Coordinator user is on a custom role (e.g. "Project Cordinator", "Project cordinator1", "pccordinator 2", "Project Incharge"). So the gate never opened for real users. Switching the gate to `canEdit("masters_assignments")` makes it work for every current and future PC custom role automatically — just tick "edit" on Project Assignments for that role in User Management.

## Changes

### 1. `src/components/ProjectAssignments.tsx` (frontend only)
- Drop the `useAuth` / `hasRole` based check.
- Replace `isAssignmentsAdmin` with `canEdit("masters_assignments")`:
  - `canCreate = canEdit("masters_assignments") || canEdit(cfg.createPermScreen)`
  - `canAssign = canEdit("masters_assignments") || canEdit("masters_projects")`
- No other behaviour change. The "Add & Assign" dialog for contractors and the inline create input for departments / categories already exist — they will simply unlock for PCs.

### 2. RLS policies (single migration)
Extend the existing Manage policies so PC custom-role users can actually write the rows the UI exposes. Match on `has_screen_edit(auth.uid(), 'masters_assignments') AND has_project_access(auth.uid(), project_id)` (function already exists in DB). Admin policies stay as-is.

- `project_contractors`, `project_departments`, `project_categories` — extend Manage policy to also allow users with `masters_assignments` edit + project access (USING + WITH CHECK).
- `contractors`, `departments`, `worker_categories` — extend Manage policy so the inline "Add & Assign" inserts succeed for the same users. No project scoping on the master tables themselves (they're global); the join-table insert that follows is still project-scoped.

The previous migration added similar policies tied to the built-in `project_coordinator` role; those stay but are now effectively unused. Safe to leave in place.

### 3. No changes to
- `src/hooks/use-permissions.tsx` — `project_coordinator` baseline already grants `masters_assignments: "edit"`; the screen will continue to appear in the sidebar for that built-in role, and for any custom role with edit on this screen.
- Sidebar, ScreenGuard, route file — already keyed off `canView("masters_assignments")`.
- Other master screens, Daily Entry, Approvals, Reports, User Management.

## Verification
1. Pick a real PC user (e.g. on the custom role "Project Cordinator"). In User Management, confirm that custom role has **edit** on "Project Assignments (Master)". If not, tick it — that single tick is now the only gate.
2. Sign in as that user → open Project Assignments → confirm:
   - Project picker works.
   - "Add & Assign" button visible on Contractors tab; dialog opens and creates + assigns a contractor.
   - "Create new department / category" input + button visible on those tabs and works.
   - Checkbox toggle, "Select all matching", and auto-assign categories on department add all work.
3. Sign in as Supervisor / Manager — Project Assignments hidden in sidebar; URL access blocked. No regression.
4. Sign in as Admin — unchanged.

## Out of scope
No schema changes beyond policy edits, no changes to other screens, no data migration.
