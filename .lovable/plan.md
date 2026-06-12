## Goal

Make the DLR Excel/CSV export columns match the on-screen preview exactly, using the same data-driven logic that already works for category columns. No hardcoded labels, no contractor fallbacks that introduce empty columns.

## What's wrong today

The Total Labour sub-columns mix two sources:
- `daily_manpower` records for the selected date (records-driven, like categories)
- `project_contractors` configuration (fallback that adds extra columns with no data)

When the project has assigned contractors that recorded no entries for the date, the export ends up with extra Total Labour columns (e.g. an empty "Shuttering & Rod Bending Work" column) that do not represent the actual data. The category columns don't have this problem because they're driven strictly from records (plus project category config that has data).

## Change

In `src/routes/reports.tsx` (DlrTab effect):
- Build `natureSet` strictly from `daily_manpower` rows for the selected project + date, exactly like the category logic.
- Drop the "fallback to project_contractors when no rows" branch so empty days produce no Total Labour sub-columns instead of synthetic ones.
- Keep `contractorNatureMap` (used for aggregation) sourced from records first; `project_contractors` only contributes a name lookup for record contractors, not new columns.

In `src/lib/dlr-daily.ts`:
- No structural changes. `getDlrDailyMatrix`, `buildDlrDailyWorkbook`, and `buildDlrDailyCsv` already render from the same `matrix.bands`, so once the input is fixed the export will match the preview byte-for-byte.

## Validation

- Pick BHELSTPP / 12-06-2026: count distinct `contractors.nature_of_work` values in `daily_manpower` for that day; preview header and exported XLSX header must list exactly those, in the same order, with the same totals.
- Pick a date with zero records: preview and export both show no Total Labour sub-columns (just the parent "Total Labour" header collapsed to a single column with `-`).
- Confirm no string literals like "NMR", "Pump Gang", "Sub Contractors/Job Works" exist in `src/lib/dlr-daily.ts`, `src/components/DlrDailyPreview.tsx`, or the DLR section of `src/routes/reports.tsx`.