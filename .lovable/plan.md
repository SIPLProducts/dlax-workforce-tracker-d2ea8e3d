## Issue

When a non-admin user (e.g. `vijay`, role: Project End User) tries to **edit** an existing draft Daily Entry sheet and clicks Save, they get:

`duplicate key value violates unique constraint "daily_manpower_entry_date_project_id_contractor_id_departme_key"`

### Root cause

The save flow currently:
1. Deletes existing `daily_manpower` rows for the project + date.
2. Re-inserts the edited rows.

But the database `daily_manpower` DELETE policy only allows **admins**. So the delete silently fails for the saver, and the next insert collides with rows that are still there → the unique-constraint error.

The save user must also be allowed to edit/delete their own draft rows.

## Plan

1. **Update the database delete rule** for `daily_manpower` so the same people who can create entries can also clean them up when re-saving a draft:
   - Admins: any row (unchanged).
   - Supervisors or users with `Daily Entry = Edit`: can delete rows on their assigned projects, but **only when the sheet is still in `draft` or `rejected` status** (never approved/pending).

2. **Make the save code resilient**:
   - Switch from "delete-all-then-insert-all" to an **upsert** on the natural key (`project_id, entry_date, contractor_id, department_id, category_id`), so re-saving an existing row updates it instead of inserting a duplicate.
   - Then delete only the rows the user removed from the sheet (cleared all values), with the new delete permission above.
   - If anything fails, stop and show a clear message instead of continuing.

This guarantees: whoever can save an entry can also edit it later, without exposing delete access to other users.

## Technical details

- DB migration: replace the current `daily_manpower` DELETE policy with one that also allows supervisors / `has_screen_edit('daily_entry')` users on their assigned projects when the row's `status IN ('draft','rejected')`.
- Code change in `src/routes/daily-entry.tsx → handleSave`:
  - Replace the unconditional `delete().eq(project_id).eq(entry_date)` + bulk `insert` with `upsert(..., { onConflict: 'entry_date,project_id,contractor_id,department_id,category_id' })`.
  - After upsert, delete only contractor rows that were cleared in this edit.
  - Surface any error via `toast.error(error.message)` instead of swallowing it.