## Problem

When saving the Daily Manpower Entry sheet, Postgres rejects the insert with:

```
duplicate key value violates unique constraint
"daily_manpower_entry_date_project_id_contractor_id_departme_key"
```

The unique key is `(entry_date, project_id, contractor_id, department_id, category_id)`.

### Root cause

In `src/routes/daily-entry.tsx` (`handleSaveDraft`, ~lines 469–522), the grid renders each category once under its assigned department and **again** under the synthetic "Other" group when the same category is also linked to another department globally (visible in the screenshot: "Security" appears both under the *Security* department and inside *Other*).

On save, each `__other__` orphan cell is resolved back to a real `department_id` via `department_categories`. If the user typed a number in **both** the real cell and the "Other" cell for the same category — or even if only the "Other" cell has a value but a real cell for the same `(department_id, category_id)` is also produced by another path — two insert rows end up with the exact same composite key and the DB rejects the batch.

## Fix

Single change in `src/routes/daily-entry.tsx`, inside the contractor loop in `handleSaveDraft`:

1. Build a per-contractor map keyed by `${department_id}|${category_id}` instead of pushing directly into `inserts`.
2. When the same key is produced twice (real cell + resolved "Other" cell), **merge** them:
   - `headcount`: sum the two values.
   - `remarks` / `weather_condition`: keep the first non-empty value (these are header-level fields already only set on `idx === 0`).
3. After the loop for a contractor, push the merged rows into `inserts`.

This eliminates the duplicate composite key before it reaches Postgres while preserving any numbers the user entered in either cell.

### Out of scope

- No DB / RLS / schema changes — the unique constraint is correct and should stay.
- No UI change to how "Other" cells are rendered (separate question whether to hide categories in "Other" that already have a real department column; not touching that here).
- No changes to approval flow, delete-then-insert strategy, or any other route.

## Verification

- Reproduce on `/daily-entry` with a project where a category (e.g. *Security*) is assigned to both its own department and appears under *Other*; enter values in both cells and save — should succeed with a single merged row.
- Existing flows with no "Other" overlap continue to insert one row per cell as before.
