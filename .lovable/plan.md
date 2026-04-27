## Diagnosis

When `bhelstpp` (supervisor) opens **Daily Entry**, the project dropdown is empty and no entry sheet appears. Investigation in the database shows:

- `bhelstpp` has the `supervisor` role ✅
- `user_projects` table contains **0 rows** for this user (and 0 rows in total across the whole DB) ❌

So no project assignment was actually saved, even though you opened the assignment dialog. Because non-admins only see projects through the `has_project_access(user, project)` RLS check, an empty `user_projects` table means the projects list is empty → the dropdown is empty → the entry sheet never shows.

The save code in `users.tsx` (`handleSaveProjectsAssign`) looks correct — it does diff `toAdd`/`toRemove` and inserts into `user_projects`. The most likely causes are:

1. The dialog was opened, projects ticked, but **"Save" was never clicked** (closed via X / outside-click, which discards changes).
2. Save was clicked but the toast / error was missed.
3. Assignment was attempted from a non-admin session (RLS would block silently in some flows).

## Fix plan

Two parts: (a) make this impossible to miss in the future, (b) give the user a clear path to recover right now.

### 1. Daily Entry: explicit "no projects assigned" state

In `src/routes/daily-entry.tsx`, when `projects.length === 0` after loading, show a clear empty-state card instead of an empty dropdown:

> "No projects assigned to your account. Ask an admin to assign projects in **User Management → Projects**."

This makes the root cause obvious to any supervisor/manager who lands on the page.

### 2. User Management: confirm project assignment saves

In `src/routes/users.tsx` `handleSaveProjectsAssign`:

- Add a guard: if neither `toAdd` nor `toRemove` has anything, show an info toast ("No changes") instead of silently closing — so you know the click registered.
- Surface RLS errors clearly (already throws, but add a console.error for diagnosis).
- After save, re-read `user_projects` for that user and verify the row count matches the selection. If mismatch, show an error toast instead of "updated".

### 3. One-time recovery for `bhelstpp`

You can either:
- Re-open **User Management → Projects** for `bhelstpp`, tick the projects, and click **Save**, OR
- I can run a quick admin migration that inserts the project assignment(s) directly. Tell me which project(s) `bhelstpp` should have access to.

## Files to change

- `src/routes/daily-entry.tsx` — add empty-state when no projects are visible.
- `src/routes/users.tsx` — harden `handleSaveProjectsAssign` with verification + clearer feedback.

## Out of scope

- No RLS changes. Existing `has_project_access` policy is correct.
- No schema changes.
- Permissions hook / sidebar flicker fixes from the previous turn stay as-is.