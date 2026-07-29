## Goal
Replace the single "Week Starting" input in the Weekly Report tab with **From Date** and **To Date** filters. The report matrix and PDF expand to cover exactly the selected range (N days instead of a fixed 7). All other Reports tabs and functionality stay unchanged.

## Changes

### `src/lib/weekly-report.ts`
- `buildWeeklyMatrix` accepts `{ project, fromDate, toDate, entries }` instead of `weekStart`.
- Compute `days` as the inclusive day list between `fromDate` and `toDate` (length N, guard N ≥ 1).
- Row/totals `days` arrays sized to N.
- `perWeek` becomes `total / N` (kept as field name for compatibility) — displayed label updated in UI/PDF to "Per Day Avg (Total/N)".
- `weeklyDateRangeLabel` uses `fromDate`→`toDate`.

### `src/lib/weekly-report-pdf.ts`
- Use `m.days.length` for column count; day header labels driven from `m.days`.
- Column widths and page orientation stay landscape A4. When N is large the autotable will shrink font/scale; no manual pagination needed.
- Last column header: "Per Day Avg (Total/N)".

### `src/routes/reports.tsx` — `WeeklyTab`
- State: `fromDate: Date` (default today), `toDate: Date` (default today+6 to preserve current UX).
- Replace the single Week Starting popover with two date pickers (`From Date`, `To Date`) using the same shadcn Popover+Calendar pattern already used in the Daily Labour Report tab.
- Validation: if `toDate < fromDate`, show inline hint and disable PDF button; do not fetch.
- Query `daily_manpower` with `entry_date` between `fromDate` and `toDate`.
- Pass `fromDate`/`toDate` to `buildWeeklyMatrix`.
- File name: `Weekly-Labour-Report-<code>-<ddMMyyyy>-to-<ddMMyyyy>.pdf`.
- Preview table header row generates N `IR/NMR` column pairs from `matrix.days`; totals row unchanged in structure.

### Preserved
- Project multi/single selection UI unchanged (still single-project `ProjectCombobox`).
- Daily, Daily Labour Report, and Summary tabs untouched.
- PDF layout (header band, KPC branding, grid styling) unchanged aside from dynamic column count and the renamed last column.

## Verification
- Selecting From=To (single day) renders 1 IR/NMR pair, totals equal that day.
- Selecting a 7-day range matches the previous Weekly output byte-for-byte in structure.
- Selecting a 14-day range shows 14 day columns in both preview and PDF.
- Invalid range (To < From) disables PDF and shows a hint.
- Other Reports tabs unaffected.

## Files
- `src/lib/weekly-report.ts`
- `src/lib/weekly-report-pdf.ts`
- `src/routes/reports.tsx`
