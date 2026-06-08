## Plan

1. **Fix the Daily Entry load logic**
   - In `src/routes/daily-entry.tsx`, keep the user's currently assigned department/category columns as the source of truth.
   - When saved rows are loaded, detect rows whose saved department/category pair is no longer displayed in the current Entry Sheet.
   - If the old row has the same department name and category name as a current column, merge that saved value into the current visible column instead of rendering it again under **Unassigned (saved earlier)**.
   - Only show **Unassigned (saved earlier)** for old rows that cannot be matched by name to any current column.

2. **Prevent double-counting after save**
   - Track the IDs of old/orphan rows that were merged into current columns.
   - On Save, after writing the current visible values, delete those merged duplicate old rows for the same sheet/date.
   - This prevents the entered value from being added again on the next refresh.

3. **Tighten orphan detection**
   - Use the actual displayed column list (`allCells`) instead of a broad department × category cross-product.
   - This avoids hidden saved rows being treated as valid when the pair is not actually shown in the table.

4. **Keep safety behavior for true unmatched historical data**
   - If an old saved row cannot be matched to any current column by department/category name, keep the current read-only **Unassigned (saved earlier)** display so historical data is not silently lost.

5. **Root-cause check result**
   - I checked the backend data for sheet `DE-000048`: the currently saved rows total **13**, and the department/category masters do **not** currently show duplicate names.
   - The inconsistent total is caused by the app’s existing orphan-row display/preserve logic, not by the current saved total for that sheet.

## Expected result

- If the user enters **13**, the Entry Sheet, Saved Entries list, refresh, and later View/Edit mode will continue showing **13**.
- Old matching saved rows will no longer appear as extra duplicated columns or inflate totals.