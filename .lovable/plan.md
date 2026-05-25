## Problem

`ScreenGuard` only checks **view** permission. Master screens (Projects, Contractors, Departments, Categories) render Add / Edit / Delete / Upload buttons unconditionally, so a view-only user (e.g. Project Coordinator) can open the dialog and click Create. The DB blocks it via RLS, surfacing the cryptic red "new row violates row-level security policy" toast.

## Fix

In the four Master screens, read `canEdit(<screen_key>)` from `usePermissions()` and intercept every write action. When the user does **not** have edit permission, show a friendly toast:

> **You are in View mode, not in Edit mode.**

Behavior per screen (Projects, Contractors, Departments, Categories):

- **Add / Upload / Edit / Delete buttons** — remain visible and clickable, but if `!canEdit` the handler short-circuits and shows the View-mode toast (instead of opening the dialog or calling Supabase).
- **Create / Update button inside the dialog** — same guard at the top of `handleSave` so even if the dialog is already open, saving shows the popup instead of hitting RLS.
- **Template / Download** — unchanged (read-only export).

Files to edit:
- `src/routes/masters.projects.tsx` — gate by `canEdit("masters_projects")`
- `src/routes/masters.contractors.tsx` — gate by `canEdit("masters_contractors")`
- `src/routes/masters.departments.tsx` — gate by `canEdit("masters_departments")`
- `src/routes/masters.categories.tsx` — gate by `canEdit("masters_categories")`

Implementation detail: a small `requireEdit()` helper inside each component:
```ts
const { canEdit } = usePermissions();
const requireEdit = () => {
  if (!canEdit("masters_projects")) {
    toast.error("You are in View mode, not in Edit mode.");
    return false;
  }
  return true;
};
```
Called at the start of `handleSave`, `handleEdit`, `handleDelete`, `handleUpload`, and the Add Project trigger.

No DB / RLS changes — RLS stays as the backstop; this just replaces the confusing RLS error with a clear, user-friendly message.
