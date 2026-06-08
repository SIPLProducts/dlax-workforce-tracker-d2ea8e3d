I checked sheet DE-000048 in the backend: the saved rows currently total 13. The mismatch shown in the screenshot is a UI/load issue, not because the saved sheet total is 39.

Root cause to fix:
- The Entry Sheet can still render old “Unassigned (saved earlier)” columns alongside the real current columns.
- When those orphan columns appear, the total calculation counts them more than once, so the grid can show 39 even though Saved Entries correctly shows 13.
- The loader is not reliably re-running when the department/category link assignments finish loading or change, so rows that should map into current columns can remain displayed as orphan columns.

Plan:
1. Update the Daily Entry load trigger
   - Make `loadEntries()` depend on the actual displayed cell definitions, including department-category links.
   - Avoid classifying saved rows as orphan rows before project assignment columns are ready.

2. Fix total calculations
   - Count each displayed cell exactly once.
   - Remove the extra orphan-cell summing in row totals, contractor totals, and grand totals.
   - This will prevent inflated totals like 39 when the true saved total is 13.

3. Tighten orphan display behavior
   - Only show “Unassigned (saved earlier)” when a saved row truly cannot be matched to any current department/category column.
   - If the saved department/category name matches a current visible column, merge it into that current column and do not render a duplicate orphan column.

4. Validate against the reported sheet
   - Re-check DE-000048 after the code change so Entry Sheet total and Saved Entries total both show 13.
   - Confirm fresh entries save and reload with the exact same entered counts.