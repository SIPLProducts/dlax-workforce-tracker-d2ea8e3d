## Goal
What you type into the Daily Entry Sheet must be what you see after Save and after refresh — no extra "Unassigned (saved earlier)" columns inflating the total.

## Root cause
In `src/routes/daily-entry.tsx` (`loadEntries`, lines ~382–424), any saved `daily_manpower` row whose `(department_id, category_id)` is no longer present in the project's current `project_departments` + `project_categories` + `department_categories` joins is treated as an **orphan** and rendered as a separate **"Unassigned (saved earlier)"** column group.

- Edit mode hides orphans → shows your typed `13`.
- View mode adds orphans on top → shows `39`.

In your case the orphan columns have the *same names* as the live columns (Painting / Structural Steel Work / Street Lighting), because either:
1. there are duplicate `departments` / `worker_categories` rows with the same name but different `id`s, or
2. dept/cat IDs that were used previously got unassigned from the project and replaced by different IDs with the same name.

So the same headcount is being counted twice — once under the current ID, once under the old ID.

## Fix — `src/routes/daily-entry.tsx` only

### A. Merge orphans into matching live columns on load
In `loadEntries`, after computing orphan `(deptId, catId)` pairs and their `dept.name` + `cat.name`:
1. Build a lookup of currently-assigned cells keyed by `lower(deptName) + "||" + lower(catName)`.
2. For each orphan row, if a live cell matches by name:
   - add its `headcount` into that live cell's value on the row (`r.cells[liveKey] += headcount`),
   - record the orphan `daily_manpower.id` in a new `mergedOrphanIdsRef` for cleanup on Save,
   - do **not** add the pair to `orphanCells`.
3. If no live cell matches by name, keep the existing fallback (still shown in "Unassigned (saved earlier)" so data is never silently dropped).

Result: View and Edit both show the same value, equal to what was typed.

### B. Clean up merged orphan rows on Save
In the existing Save handler, after the upsert of current cells succeeds, delete any `daily_manpower` rows whose ids are in `mergedOrphanIdsRef`. This prevents the duplicate count from reappearing on the next load. Unmerged orphans (no name match) are left untouched.

### C. Defensive: prevent fresh entries from going stale
Keep the existing `setRows` reset and the orphan re-detection on every `loadEntries` so a fresh entry session always reflects DB state after Save.

## Diagnostic SQL (you run on your self-hosted DB)
After the code fix lands, run this once to find the duplicate masters so new orphans stop being created:

```sql
-- Departments with duplicate names
SELECT lower(name) AS name, count(*) AS dup_count, array_agg(id) AS ids
FROM departments
GROUP BY lower(name) HAVING count(*) > 1;

-- Categories with duplicate names
SELECT lower(name) AS name, count(*) AS dup_count, array_agg(id) AS ids
FROM worker_categories
GROUP BY lower(name) HAVING count(*) > 1;

-- For sheet DE-000048 on 2026-06-08: which dept/cat ids have saved
-- headcount but are NOT in the project's current assignment
SELECT dm.department_id, d.name AS dept,
       dm.category_id, c.name AS cat,
       SUM(dm.headcount) AS total
FROM daily_manpower dm
JOIN departments d ON d.id = dm.department_id
JOIN worker_categories c ON c.id = dm.category_id
WHERE dm.project_id = (SELECT project_id FROM daily_manpower_sheets
                       WHERE sheet_code = 'DE-000048')
  AND dm.entry_date = '2026-06-08'
  AND (dm.department_id NOT IN (SELECT department_id FROM project_departments
                                WHERE project_id = dm.project_id)
    OR dm.category_id NOT IN (SELECT category_id FROM project_categories
                              WHERE project_id = dm.project_id))
GROUP BY 1, 2, 3, 4;
```
Once you know the duplicate IDs, deactivate or merge the unused ones in the masters so new entries always land on a single canonical (dept, cat) pair.

## Out of scope
- No DB migration, no RLS / schema changes.
- No change to Saved Entries tab, approval flow, reports, or Excel export.
- Sticky-column / table-layout work from the previous turn is untouched.

## Files touched
- `src/routes/daily-entry.tsx` — name-based merge in `loadEntries`; delete merged orphan ids in Save.
