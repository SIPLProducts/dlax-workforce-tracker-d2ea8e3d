
## Goal
Add a new **Daily Labour Report (DLR)** to the Reports screen that exports the exact layout of the uploaded reference file. Selection requires **one project** and **one date**. Provide **two download buttons: Excel (.xlsx)** and **CSV (.csv)**.

## UI changes (single screen: `/reports`)
- Add a 4th tab **"Daily Labour Report"** to the existing Tabs (Daily / Project / Contractor stay unchanged).
- Inside this tab:
  - **Project** — single-select combobox (no "All"; required).
  - **Date** — single date picker.
  - **Download Excel** button (.xlsx) and **Download CSV** button (.csv), both disabled until a project and date are chosen.
  - **Preview table** rendering the same matrix that will be exported, so the user can confirm before downloading.
- The existing top-level Export button keeps working for the other tabs.

## File layout (matches the reference exactly)
20 columns in this order:
`Sl.No | Name of the Project | Masons | Carpenters | Steel Fixers | Painters | Helpers (Civil) | Skilled (MEP) | Helpers (MEP) | Mason (NMR) | Helpers (M) | Helpers (F) | Sub Contractors/Job Work | NMR | Total | NMR % on Total | Budget NMR | NMR % on Budget | Security | Remarks`

Header rows (rows 1–5):
```text
Row 1: DAILY LABOUR REPORT\n<dd-mm-yyyy>   (merged across all cols, wrap, bold, centered)
Row 2: Sl.No | Name of the Project | Sub Contractors/Job Works (C2:I2 merged) | NMR (J2:L2) | Total Labour (M2:N2) | Total | NMR % on Total | Budget NMR | NMR % on Budget | Security | Remarks
Row 3: Civil (C3:G3 merged) | MEP (H3:I3 merged)
Row 4: Masons | Carpenters | Steel Fixers | Painters | Helpers | Skilled | Helpers | Mason | Helpers (M) | Helpers (F) | Sub Contractors/Job Work | NMR
Row 5: Tiles, Granite, Brickwork, Glazing | Shuttering, Scaffolding, Wood works | Fabricator works, Rod benders   (under Masons/Carpenters/Steel Fixers)
Row 6+: project_group section header row, then the selected project's data row
```

CSV note: CSV cannot represent merged cells or styling, so the CSV writes the **same 20-column layout** as plain rows (header rows 1–5 included verbatim, empty cells where merges would span). This matches the structure of the reference CSV the user uploaded as the comparison baseline.

## Data mapping (Supabase)
Query: `daily_manpower` for `project_id = $project AND entry_date = $date`, joined to `projects`, `contractors`, `worker_categories`, `departments`.

- **Sl.No / Project Name / Section row** — from `projects.code`, `projects.name`, `projects.project_group`.
- **Category columns** (Masons … Helpers (F)) — sum `headcount` matched to `worker_categories.name` via a case-insensitive alias map kept in the helper. Unmatched categories don't populate a column but still feed Totals.
- **Sub Contractors/Job Work** — sum of headcount where `contractors.nature_of_work = 'Item Rate'`.
- **NMR** column — sum of headcount where `contractors.nature_of_work = 'NMR'`.
- **Total** — Item Rate + NMR.
- **NMR % on Total** — `NMR/Total` (formula in xlsx, computed value in csv), formatted as `0%`; blank if Total = 0.
- **Budget NMR** — 0 placeholder (no DB field today).
- **NMR % on Budget** — `IFERROR(NMR/Budget,"")`.
- **Security** — 0 placeholder.
- **Remarks** — concatenated unique remarks for that project+date.

Zero values render as `-` (Excel number format `#,##0;(#,##0);-`; CSV writes literal `-`).

## Formatting (Excel only)
- Bold + centered + wrap-text on header rows; thin borders across the table.
- Column widths sized to fit headers; freeze top 5 rows + first 2 columns.
- Number format `#,##0;(#,##0);-`; percentage cells `0%`.

## Files
- `src/routes/reports.tsx` — add the 4th tab, its controls, preview, and the two download buttons. No changes to existing tabs/exports.
- `src/lib/dlr-daily.ts` *(new)* — pure helpers:
  - `getDlrDailyMatrix({ project, date, rows })` → 2D array used by the preview, .xlsx writer, and .csv writer (single source of truth).
  - `buildDlrDailyWorkbook(matrix, meta)` → SheetJS workbook (merges, widths, freeze, number formats).
  - `buildDlrDailyCsv(matrix)` → RFC-4180 CSV string from the same matrix.
- `src/components/DlrDailyPreview.tsx` *(new)* — renders the matrix as a styled read-only HTML table.
- `package.json` — ensure `xlsx` is installed (`bun add xlsx` if missing).

Download filenames:
- `DLR-<PROJECT_CODE>-<dd-mm-yyyy>.xlsx`
- `DLR-<PROJECT_CODE>-<dd-mm-yyyy>.csv`

## Out of scope (untouched)
- Existing Daily / Project / Contractor tabs, their filters, KPIs, breakdown cards, and current CSV export
- Daily Entry, Approvals, Masters, Auth/RLS, DB schema
- The monthly DLR pivot sheet (different layout in the reference) — not requested
- Any visual changes outside the new tab

## Risks
- If `worker_categories.name` values don't match the reference labels, some category columns will be empty even when Totals are correct. The alias map can be extended without code-structure changes.
- `Budget NMR` stays 0 until a project budget field is added (future, out of scope).
