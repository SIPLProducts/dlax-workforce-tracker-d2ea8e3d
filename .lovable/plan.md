
## Goal
Make the **Daily Labour Report** headers dynamic per project: columns come from the categories assigned to the selected project (grouped by their department), instead of the hard-coded reference list. The overall framing (Sub Contractors/Job Works · NMR · Total Labour · Total · NMR% on Total · Budget NMR · NMR% on Budget · Security · Remarks) stays exactly like the reference.

## Header structure (dynamic part)

For the selected project, build a category list from:
- `project_categories` JOIN `worker_categories` JOIN `department_categories` JOIN `departments` for that project.
- Fallback: if a project has no rows in `project_categories`, use all `worker_categories` linked via `department_categories` to a department (global fallback, consistent with current master-fallback behavior).
- Sort: by `departments.name` then `worker_categories.display_order`, then `worker_categories.name`.

Group the categories under their department. Each department becomes a second-row sub-band; each category becomes a leaf column.

Resulting header band:
```text
Row 1: "DAILY LABOUR REPORT\n<dd-mm-yyyy>"  (merged across all columns)
Row 2: Sl.No | Name of the Project | Sub Contractors/Job Works (merged across all dynamic dept columns) | NMR (merged across NMR-tagged dept columns, if any) | Total Labour (Sub Contractors/Job Work | NMR) | Total | NMR % on Total | Budget NMR | NMR % on Budget | Security | Remarks
Row 3: (under Sub Contractors/Job Works) <Dept A>  (merged across its categories) | <Dept B> (...) | ...
        (under NMR) <NMR Dept> (if exists)
Row 4: <Cat 1> | <Cat 2> | ... (one cell per category)
```

How "NMR" vs "Sub Contractors/Job Works" is decided per category column:
- A category lives under "NMR" if its department is flagged as NMR (department name contains "NMR", case-insensitive) — easy heuristic, no schema change.
- Otherwise it lives under "Sub Contractors/Job Works".
- If a project has no NMR-tagged department, the "NMR" top band collapses to zero width and only "Sub Contractors/Job Works" spans the dynamic columns; the Total Labour `NMR` sub-column still appears (from contractor `nature_of_work = 'NMR'` aggregation).

Right-side columns stay fixed (Total Labour · Total · NMR% on Total · Budget NMR · NMR% on Budget · Security · Remarks).

## Cell values (data row)

For the project + selected date, aggregate `daily_manpower` rows:
- Per dynamic category column: sum of `headcount` where `category_id = <that category>`.
- Total Labour → `Sub Contractors/Job Work` = sum where `contractors.nature_of_work = 'Item Rate'`.
- Total Labour → `NMR` = sum where `contractors.nature_of_work = 'NMR'`.
- `Total` = Sub Contractors/Job Work + NMR.
- `NMR % on Total` = NMR / Total (blank if Total=0).
- `Budget NMR` = 0 placeholder.
- `NMR % on Budget` = blank (no budget field).
- `Security` = 0 placeholder.
- `Remarks` = concatenated unique remarks for that project+date.
- Zero values render as `-` (Excel format `#,##0;(#,##0);"-"`).

Section row (project_group label) above the project row stays as today.

## Files to change

- `src/lib/dlr-daily.ts` — replace the hard-coded `DLR_CATEGORY_COLUMNS` / `ALIASES` matching with a dynamic builder:
  - New input shape: `getDlrDailyMatrix({ project, date, rows, departments })` where `departments` is `Array<{ name: string; isNmr: boolean; categories: Array<{ id: string; name: string }> }>`.
  - Recompute total column count, merges, and per-category data cells from this dynamic structure.
  - Excel writer (`buildDlrDailyWorkbook`) and CSV writer (`buildDlrDailyCsv`) keep the same public API but consume the new matrix shape; merges are derived from the dynamic header structure (no hard-coded indexes).
- `src/components/DlrDailyPreview.tsx` — render the same dynamic 3-row header band from the matrix metadata (the matrix now carries `headerBands` so preview and export stay in sync).
- `src/routes/reports.tsx` (DlrTab) — load the project's department + category structure when `projectId` changes:
  1. `select * from project_categories where project_id = $project` (with `worker_categories(*)`).
  2. If empty, use all `worker_categories` (global fallback).
  3. `select * from department_categories` to map category → department; `select * from departments` for names.
  4. Pass the resulting `departments` structure to `getDlrDailyMatrix`.

## Out of scope (untouched)

- Other Reports tabs (Daily / Project / Contractor) and their CSV export.
- Daily Entry, Approvals, Masters UIs.
- DB schema / RLS / migrations (no changes needed — uses existing `project_categories`, `department_categories`, `departments`, `worker_categories`).
- The monthly DLR pivot layout.

## Risks / notes

- A category linked to multiple departments via `department_categories` will appear under the first department by sort order to avoid duplicate columns; we'll document this in code.
- If a project has neither `project_categories` nor any `department_categories` mapping, the dynamic band renders empty and only the right-side fixed columns + Totals appear; data row still works because totals come from `contractors.nature_of_work`.
- Excel merges are computed from runtime band widths, so the exported file's structure shifts per project, exactly as requested.
