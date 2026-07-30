## Problem (confirmed from backend data)

For 29-07-2026 the actual entries are:

```text
Civil        Painting 1, Structural Steel Work 1
Electrical   Electrician 3, Street Lighting 3, Technician 6
Housekeeping Cleaner 3, Sweeper 3
Maintenance  Electrician 3
NMR          Cleaner 3, Sweeper 6
```

Total = 32 (31 draft + 1 approved), which matches the Daily Entry sheet, Dashboard and Weekly Report.

The Daily Labour Report shows 52 because it aggregates headcounts **by category only, ignoring the department**. The same category name/id is used under several departments (Electrician under Electrical *and* Maintenance; Cleaner/Sweeper under Housekeeping *and* NMR). In `src/lib/dlr-daily.ts` `buildProjectDataRow` builds `catTotals[category_id]`, then every column that uses that category id reads the same total — so Electrician shows 6 in both Electrical and Maintenance, Cleaner 6 in both Housekeeping and NMR, etc. That is exactly the repeated `6 / 6 / 9` pattern in the attached screenshot, and it also inflates the Sub-Contractor / NMR / Total figures.

## Fix

Scope the aggregation key to department + category.

1. `src/lib/dlr-daily.ts`
   - Add `deptId` to `DlrDept` / the `catCols` entries in `HeaderBands` (departments are already passed with their ids available in the caller).
   - In `buildProjectDataRow`, key totals as `` `${r.department_id}|${r.category_id}` `` and read each column with its own `deptId|catId` key.
   - Sub-contractor vs NMR splits and the Total column then follow automatically from the corrected per-column values.

2. `src/routes/reports.tsx` (DLR tab)
   - Pass the department id along with each department's categories into `getDlrDailyMatrix` (the `deptEntries` structure already carries `id`; currently it's stripped before being set into state).

3. `src/lib/dlr-daily-matrix.ts`
   - It reads values straight from the matrix data row and only uses `deptName` for the NMR/sub split, so it needs no logic change; verify the NMR split still resolves after the type change (match on `deptId` instead of name for safety).

## Preserved

- No schema or query changes; same approval-status filter, same date/project filters.
- Excel / Matrix Format / CSV exports keep their current layouts — only the numbers correct themselves.
- Dashboard, Weekly, Summary, Daily Entry untouched.

## Verification

For 29-07-2026 with Status = All, the DLR row should read: Civil Painting 1, Structural Steel Work 1, Electrical Electrician 3 / Street Lighting 3 / Technician 6, Housekeeping Cleaner 3 / Sweeper 3, Maintenance Electrician 3, NMR Cleaner 3 / Sweeper 6 → Sub-Contractors 23, NMR 9, **Total 32**, consistent with the Weekly Report and Dashboard.

## Files

- `src/lib/dlr-daily.ts`
- `src/lib/dlr-daily-matrix.ts`
- `src/routes/reports.tsx`
