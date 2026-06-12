## Goal
Remove all hardcoded labels from the Daily Labour Report. Every band, sub-column, and label is derived from project configuration and `contractors.nature_of_work` distinct values actually present.

## Header structure (fully dynamic)

```text
Row 0: <project name> — DAILY LABOUR REPORT — <date>     [title]
Row 1: Sl.No. | Name of the Project | <dept band 1..N> | Total Labour            | Total | NMR % on Total | Remarks
Row 2:                              | <category leaves>  | <nature_of_work band>  |
Row 3:                              |                    | <each nature_of_work>  |
```

- **Dept bands (left side)**: from project's `departments` → `worker_categories` join. No "NMR" assumption. Each department becomes a band; each category a leaf column.
- **Total Labour sub-columns**: built from `SELECT DISTINCT nature_of_work FROM contractors WHERE id IN (project contractors)` ordered alphabetically. Whatever values exist (e.g. "Item Rate", "NMR", "Daily Wage") become sub-columns. If only one value exists, single sub-column with that label. If none, single "Total Labour" leaf.
- **Fixed right columns**: `Total`, `NMR % on Total`, `Remarks`. The `NMR % on Total` column is rendered only if a nature_of_work value literally equals `NMR` (case-insensitive); otherwise dropped (no fake placeholder).
- **Removed**: `Budget NMR`, `NMR % on Budget`, `Security` (no DB backing).

## Data row aggregation

- Each category leaf: `SUM(headcount)` where `category_id = <leaf>` for project+date.
- Each Total Labour leaf (one per distinct nature_of_work): `SUM(headcount)` joined to `contractors` filtered by that `nature_of_work`.
- `Total` = sum of all Total Labour leaves.
- `NMR % on Total` (only if NMR column present) = NMR sum / Total.
- `Remarks` = unique concatenated remarks.
- Zero → `-`.

## Empty data behavior
If no `daily_manpower` rows for the selected project+date: render the full dynamic header from project config + contractors' nature_of_work distinct values; data row shows `-` in every numeric cell, blank `Remarks`, Sl.No. `1`, Name of Project = project name.

## Files to change

- `src/lib/dlr-daily.ts`
  - Extend `DlrInput` with `natureOfWorkValues: string[]` (distinct values loaded by caller).
  - Rebuild `buildBands()`: drop hardcoded "Sub Contractors/Job Works" / "NMR" / "Item Rate" branches. `totalLabourLeaves = natureOfWorkValues` (sorted). Conditionally include `nmrPctOnTotalCol` only if any leaf matches /^nmr$/i. Drop `budgetNmrCol`, `nmrPctOnBudgetCol`, `securityCol` from bands and indices.
  - `getDlrDailyMatrix()`: aggregate per nature_of_work leaf instead of fixed Item Rate/NMR pair. Pass through `contractorNatureMap: Map<contractorId, nature_of_work>` for joining manpower rows.
  - `buildDlrDailyWorkbook()` / `buildDlrDailyCsv()`: regenerate merges and cells from new band metadata; remove fixed-column literals.

- `src/routes/reports.tsx` (DlrTab)
  - When `projectId` changes, additionally query:
    - `project_contractors` → `contractors(id, nature_of_work)` for that project; build `natureOfWorkValues` = sorted distinct non-null trimmed values, and `contractorNatureMap`.
  - Pass both into `getDlrDailyMatrix`.

- `src/components/DlrDailyPreview.tsx`
  - Render header from matrix metadata only. Compute `rowSpan`/`colSpan` from the dynamic band widths. No string literals for column names — all come from matrix.

## Out of scope
Other Reports tabs, Daily Entry, Approvals, Masters, DB schema/RLS/migrations, monthly DLR pivot.
