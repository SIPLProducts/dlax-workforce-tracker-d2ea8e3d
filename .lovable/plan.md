# Show only Project Name in report sheets and downloads

All on-screen report tables and exported files currently label projects as `[CODE] Name`. Change them to show just the project name. Nothing else changes: dedicated "Code" columns, sorting, filters, totals and data logic stay exactly as they are (code remains searchable in dropdowns).

## Where the label is built

Four places produce the `[CODE] Name` string:

- `src/lib/dlr-daily.ts` (line 61) — Daily Labour Report project label, used by the on-screen table, Excel and CSV exports.
- `src/lib/dlr-daily-matrix.ts` — Matrix Format export uses the same label helper via the matrix rows.
- `src/lib/summary-matrix-xlsx.ts` (line 136) — Summary Report matrix Excel export.
- `src/lib/weekly-report-pdf.ts` (line 29) — Weekly Report PDF heading.
- `src/routes/reports.tsx` (line 821) — Summary Report CSV/table row label.

## Change

In each spot, replace `p.code ? \`[${p.code}] ${p.name}\` : p.name` with `p.name` (falling back to the code only if a project has no name, so a row is never blank).

## Verification

Open Reports and confirm Daily, Daily Labour Report, Summary and Weekly tabs show names only, then download Excel, Matrix Format, CSV and the Weekly PDF to confirm the same in each file.
