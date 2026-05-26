## Bug: Entry Sheet total (6) ≠ Saved Entries total (40)

### Root cause

Sheet **DE-000038** (project NLCHITES) has 7 rows in `daily_manpower`. One of them is:

```
contractor = ABDUR RAKIB
department = MEP        ← NOT in project's assigned departments
category   = Carpenters
headcount  = 34
```

The other 6 rows (3 Painters + 3 Security, headcount 1 each) sum to 6, which matches the Entry Sheet TOTAL. The 34 from MEP×Carpenters is silently dropped on display because the Entry Sheet grid only renders columns built from the project's **current** `project_departments × project_categories` assignments (`allCells` in `src/routes/daily-entry.tsx:243-274`). MEP was de-assigned from the NLCHITES project after that record was saved (or saved via a different path), so the column no longer exists.

Meanwhile **Saved Entries → Total Headcount** sums `daily_manpower.headcount` directly (line 410), so it correctly reports 40.

Two real problems flow from this:

1. **Display mismatch** — the user sees 40 in the list but only 6 in the sheet.
2. **Silent data loss on Save** — `handleSave` deletes ALL `daily_manpower` rows for (project, date) then re-inserts only what's visible in the grid (lines 519–539). Clicking Save right now would wipe the orphan 34 with no warning.

### Fix

In `src/routes/daily-entry.tsx`, when `loadEntries()` finishes loading `daily_manpower` rows, collect any `(department_id, category_id)` pair that appears in the saved data but is NOT in the current `allCells`. Render those as an extra read-only column group labeled **"Unassigned (saved earlier)"** at the right of the grid.

Concretely:

1. Add `orphanCells` state: `{ key, deptId, catId, deptName, catName }[]` derived during `loadEntries` by looking up names from `departments` / `worker_categories` for any DB pair not covered by `allCells`.
2. Compute a display-only `displayCells = [...allCells, ...orphanCells]` used by:
   - column headers (extra group "Unassigned" with muted styling)
   - `rowTotal` / `colTotals` (so grand total = 40)
   - cell rendering (orphan cells render as `disabled` inputs with a tooltip: "Department/category no longer assigned to this project — re-assign in Masters → Project Assignments to edit.")
3. Keep `allCells` unchanged for the **Save** path so the existing insert logic is untouched, BUT change the delete step in `handleSave` to preserve orphan rows: instead of `DELETE WHERE project_id=? AND entry_date=?`, only delete rows whose `(department_id, category_id)` is in the currently-assigned set. Orphan rows are left intact so Save never silently destroys data the UI can't represent.

### Out of scope

- No DB / RLS / migration changes.
- No change to approval flow, Send-to-Approval, or Saved Entries totals (they already report the true total).
- No UI to delete orphan rows in this pass — user must re-assign the dept/category in Masters to edit or zero them out.

### Verification

1. Open Daily Entry for NLCHITES on 26/05/2026 → grid shows existing 6 cells + an "Unassigned" group with one disabled cell `MEP × Carpenters = 34` on the ABDUR RAKIB row. TOTAL row reads 40. Matches Saved Entries.
2. Click Edit → Save with no changes → reload → all 7 rows (incl. the 34) still in DB; Saved Entries still shows 40.
3. Re-assign MEP + Carpenters in Masters → Project Assignments → reopen sheet → 34 now appears in the regular MEP column (no longer in "Unassigned"); fully editable.
4. Project with no orphan rows → no "Unassigned" group rendered (unchanged behavior).
