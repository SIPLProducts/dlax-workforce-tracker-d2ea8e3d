
## Goal

After creating a Project, allow assigning **Contractors**, **Departments**, and **Categories** to it from existing masters, or creating brand-new ones inline (saved to the global masters DB). Daily Entry will then only show items assigned to the selected project. Global masters remain available as a fallback when no assignment exists for a project.

## Database changes (migration)

Three new join tables, all with RLS:

1. `project_contractors (id, project_id, contractor_id, created_at)` — unique on `(project_id, contractor_id)`
2. `project_departments (id, project_id, department_id, created_at)` — unique on `(project_id, department_id)`
3. `project_categories (id, project_id, category_id, created_at)` — unique on `(project_id, category_id)`

**RLS policies** (per table):
- SELECT: `has_project_access(auth.uid(), project_id) OR has_role(auth.uid(),'admin') OR has_screen_edit(auth.uid(),'masters_projects')`
- INSERT/DELETE: admins, or users with edit on `masters_projects` (so a project editor can manage assignments)

**Helper function**:
- `project_has_assignments(_project_id uuid, _kind text) returns boolean` — used by the UI/Daily Entry to know whether to filter or fall back to global pool.

No changes to existing `contractors`, `departments`, `worker_categories` tables.

## UI changes

### 1. Project edit dialog (`src/routes/masters.projects.tsx`)
Convert the dialog into tabs:
- **Details** (existing fields)
- **Contractors** — multi-select picker over global `contractors`. "+ Add new" inline form (gated by `canEdit('masters_contractors')`) that inserts into `contractors` + auto-assigns.
- **Departments** — same pattern (gated by `canEdit('masters_departments')`)
- **Categories** — same pattern (gated by `canEdit('masters_categories')`)

Assignment tabs only become enabled after the project is saved (need a project id). For new project flow: save Details first, then tabs unlock.

### 2. New dedicated screen `Masters → Project Assignments`
- New route: `src/routes/masters.assignments.tsx`
- New screen key: `masters_assignments` (added to `src/lib/screens.ts` + default permissions for admin in `use-permissions.tsx`)
- UI: Project picker on top, then 3 sections (Contractors / Departments / Categories), each showing assigned items with add/remove + inline-create (same permission gating as above).
- Sidebar entry added in `AppSidebar.tsx` under Masters.

### 3. Daily Entry filtering (`src/routes/daily-entry.tsx`)
When a project is selected, fetch its assignments:
- If `project_contractors` has rows for project → show only those contractors; else fall back to all `contractors` (global fallback).
- Same logic for departments and categories.
This preserves backward compatibility with existing projects that have no assignments yet.

## Permission gating summary

| Action | Permission required |
|---|---|
| View assignments | Project access (or admin / project editor) |
| Add/remove an assignment | `masters_projects` edit (or admin) |
| Inline-create a new contractor | `masters_contractors` edit (or admin) |
| Inline-create a new department | `masters_departments` edit (or admin) |
| Inline-create a new category | `masters_categories` edit (or admin) |

If a user lacks the inline-create permission, the "+ Add new" button is hidden — they can still assign from the existing pool.

## Out of scope

- No bulk import for assignments (use existing master Upload, then assign).
- No change to approval workflow, reports, or auth.
- Existing daily_manpower rows referencing now-unassigned masters remain visible in reports (historical data is preserved).

## Files touched

- `supabase/migrations/<new>.sql` — 3 join tables + RLS + helper function
- `src/lib/screens.ts` — add `masters_assignments`
- `src/hooks/use-permissions.tsx` — admin baseline for new screen
- `src/components/AppSidebar.tsx` — nav entry
- `src/routes/masters.projects.tsx` — tabbed dialog with assignment tabs
- `src/routes/masters.assignments.tsx` — NEW dedicated screen
- `src/routes/daily-entry.tsx` — filter dropdowns by project assignments with global fallback
- `mem://features/project-master-assignments` — new memory doc + index update
