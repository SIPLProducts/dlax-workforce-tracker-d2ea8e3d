# Fix: contractor not showing on Project Assignments

## Root cause

Two distinct rows exist in `projects` with the same name and code "DLAX Metro Phase 1":
- `125eb49e-62e2-47f9-aa84-326f65c78c5d` — murthy constructions is correctly assigned here
- `ce0f92fb-2c24-47fe-9b44-58c05b27078b` — empty duplicate

The Project dropdown shows both as `DLAX Metro Phase 1 — DLAX Metro Phase 1`, so on the Assignments screen the empty duplicate was selected. Nothing is broken in the assignment code — the issue is duplicate master data + a non-distinguishing dropdown.

## Plan

### 1. Clean up the duplicate (data fix)
- Verify the empty duplicate `ce0f92fb-...` has no related records (daily_manpower, user_projects, project_contractors/departments/categories, approval config, etc.).
- Delete `ce0f92fb-...` so only the populated `125eb49e-...` remains.
- If it does have any related rows, instead rename it (e.g. append " (duplicate)") and let you decide how to merge, rather than blind-deleting.

### 2. Prevent recurrence (schema + UI)
- Add a unique constraint on `projects.code` (case-insensitive) via migration, so two projects can't share the same code again.
- In `src/routes/masters.projects.tsx`, surface a clear toast when the create/update fails on the unique constraint ("A project with this code already exists").

### 3. Make duplicates visible if they ever occur (defensive UI)
- In `ProjectCombobox`, when two projects share the same `code — name` label, append a short suffix (last 4 chars of id) so they are visually distinguishable in the dropdown. This is a tiny safety net; the unique constraint is the real fix.

## Out of scope
- No changes to the assignment save/load logic (it is working correctly).
- No changes to other masters screens.
- No changes to RLS or auth.
