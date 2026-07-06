## Two download options per report: Excel + Matrix Format

Add a second download for both the **Summary Report** and **Daily Labour Report**:

- **Excel** — the current plain `.xlsx` (data-only, minimal formatting). Kept as-is.
- **Matrix Format** — a fully-styled `.xlsx` that mirrors the attached reference template (title banner, merged banded headers, borders, fills, frozen panes, column widths, row heights).

Preview UI and data model are unchanged.

### Files touched
- `package.json` — add `xlsx-js-style` (drop-in SheetJS fork that writes cell styles; standard `xlsx` cannot).
- `src/lib/summary-matrix-xlsx.ts` — **new**. Builds the styled Summary workbook matching the `May'26` reference sheet.
- `src/lib/dlr-daily-matrix.ts` — **new**. Builds the styled DLR workbook matching the `DD.MM.YYYY` reference sheet. Reuses existing `DlrMatrix` shape from `src/lib/dlr-daily.ts`.
- `src/lib/dlr-daily.ts` — untouched (keeps current plain Excel export + CSV + preview matrix).
- `src/routes/reports.tsx`:
  - Summary card: keep existing **Export Excel** button; add **Matrix Format** button next to it that calls the new styled builder.
  - DLR card: keep existing **Download Excel** and **Download CSV**; add **Matrix Format** button that calls the new styled builder.

### Summary — Matrix Format layout
Sheet name: month label (e.g. `May'26`).
1. Row 1 — `KPC Projects Limited`, merged across all columns, centered, bold 14pt, height 42.
2. Row 2 — `Manpower engaged for the month of <Month'YY>`, merged, centered, bold 12pt.
3. Rows 3–4 — Header band:
   - `S.No` (merged vertical), `Project Name` (merged vertical).
   - `Manpower deployed at site` merged across all day+avg columns.
   - `Total labour for the month of <Month'YY>` merged vertical.
   - `Remarks` merged vertical.
   - Row 4: date-of-month per day column; `Average per Week-<n>` at each ISO-week boundary.
4. Group header rows — one per `project_group`, bold with light fill, group name in column B merged across data columns. Projects without a group render under a single unlabeled section.
5. Project rows — S.No, `[code] Name`, daily headcounts, weekly averages, month total, blank Remarks.
6. Grand Total row — bold, light fill, sums per day column and month total.

Formatting: thin black borders on every cell; Calibri 10pt; numbers right-aligned `#,##0;(#,##0);"-"`; averages `0.0`; day columns width ~4.5; avg columns width 10 with warm-tan fill; month-total column width 14 with deeper warm-tan fill matching reference; Remarks width 30. Freeze panes `xSplit=2, ySplit=4`. Landscape, fit-to-1-page-wide, 0.3" margins.

*Out of scope:* Item Rate / NMR / Total per-project sub-rows and 2-level (Roman/Alpha) hierarchy — app doesn't store contract type or a second grouping level. One row per project under a single group header. Documented in code comment.

### Daily Labour Report — Matrix Format layout
Sheet name: `DD.MM.YYYY`.
1. Row 1 — `DAILY LABOUR REPORT\n<DD-MM-YYYY>`, merged across all columns, centered, wrap-text, bold 14pt, height 42.
2. Rows 2–5 — 4-row banded header (mirrors reference):
   - `Sl.No.` (A2:A5), `Name of the Project` (B2:B5) merged vertical.
   - Row 2: department-band labels merged across their category leaves (e.g. `Civil`, `MEP`).
   - `Total Labour` band spanning `Sub Contractors/Job Work` + `NMR` sub-leaves.
   - `Total` (merged vertical), `Security` (merged vertical), `Remarks` (merged vertical).
   - Row 4: category leaf names.
   - Row 5: kept blank (reference reserves a sub-descriptor line the app has no data for).
3. Group header row if `project_group` set — bold, light fill, merged across columns B..last.
4. Data row — S.No=1, `[code] Name`, one cell per category (headcount), Sub-Contractor total = SUM of non-NMR dept totals, NMR total = SUM of NMR dept totals, Total = M+N formula, Security = 0 (no data source), Remarks joined.

Formatting: thin black borders every cell; header rows light-gray fill (`FFEFEFEF`), bold, centered, wrap-text; number cells right-aligned `#,##0;(#,##0);"-"`; Remarks wrap-text width 30; column widths from reference (`A=8, B=37, C..I=11–17, J=13, K=10, L=14, M=14, N=10, O=11, S=13, T=30`) applied to matching columns. Row heights 42/15/15/21/25 for rows 1–5; data rows 25. Freeze panes `xSplit=2, ySplit=5`.

*Out of scope:* `NMR % on Total`, `Budget NMR`, `NMR % on Budget` reference columns — no budget data in the app. Omitted so Total sits directly next to NMR. Documented in code comment.

### Technical notes
- `xlsx-js-style` has the same API surface as `xlsx` (`XLSX.utils.aoa_to_sheet`, `book_append_sheet`, `writeFile`), plus honours `cell.s` style objects. Install via `bun add xlsx-js-style`.
- Small helper `styled(v, style)` returns `{ v, t, s }`; shared `thinBorder`, `headerFill`, `avgFill`, `monthFill`, `groupFill` constants keep styling consistent.
- CSV export for DLR and the on-screen preview / Summary matrix table are unchanged.
