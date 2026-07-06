## Make "Total Labour" columns dynamic (per department) in Daily Labour Report

Currently the "Total Labour" sub-columns come from `contractors.nature_of_work` (Fabrication works, NMR works, Shuttering rod bending & casting work), which is unrelated to the actual Daily Entry Sheet.

Replace them with **one sub-column per department** that appears in the Daily Entry for the selected project + date. Each cell = total headcount for that department. Example: Civil = 6, Electrical = 7.

### Changes

**1. `src/lib/dlr-daily.ts`**
- `DlrInput`: remove `natureOfWorkValues` and `contractorNatureMap`.
- `HeaderBands`: replace the `natureValues` band with a `deptTotals` band — one leaf column per department, in the same order as the existing `depts` array. Drop the NMR-index / `pctTotalCol` ("NMR % on Total") logic.
- `getDlrDailyMatrix`: sum `headcount` per `department_id` from `rows`. Emit one leaf column per department under the merged "Total Labour" header (single "Total" cell if only one dept). Grand `Total` column = sum across departments (unchanged behavior).

**2. `src/routes/reports.tsx` — `DlrTab` (~lines 420-496)**
- Remove `natureOfWorkValues`, `contractorNatureMap`, and the code that builds them from `dmRows`.
- Update the `getDlrDailyMatrix` call to match the new input shape (departments still drive both the category band and the new Total Labour band).

**3. `src/components/DlrDailyPreview.tsx`**
- Replace `b.natureValues` header rendering with the new dept-totals band (label each sub-column with the department name).
- Remove the `pctTotalCol` / `fmtPct` "NMR % on Total" column.

**4. Excel/CSV export (`buildDlrDailyWorkbook`, `buildDlrDailyCsv`)**
- Drop the `pctTotalCol` merges and percent formatting.
- Merges/column widths continue to work off the same band metadata (now dept-based instead of nature-of-work-based).

### Out of scope
- No schema changes; `contractors.nature_of_work` stays in the DB, it just no longer drives this report.
- No changes to filters, KPI cards, Daily tab, or Summary tab.
- Category columns (Painting, Structural Steel Work, Street Lighting, ...) already come from the Daily Entry Sheet and are unchanged.
