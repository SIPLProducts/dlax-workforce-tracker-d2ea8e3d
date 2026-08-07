# Fix Matrix Format download in Daily Labour Report

The Excel download is correct: one sheet with every selected project as a row, grouped by project group. The Matrix Format download instead builds one sheet per project (each sheet holding a single row), which is why projects appear "one by one".

## Change

1. **`src/lib/dlr-daily-matrix.ts`**
   - Change the sheet builder to render all project rows of a single matrix instead of just `matrix.dataRow`.
   - Walk the matrix rows: group section rows render as a merged, highlighted band row (same as the styled Excel/preview); project rows render Sl.No, project name, each category headcount, Sub Contractors/Job Work total, NMR total, Total, Security (0) and Remarks — keeping the existing fonts, borders, number format `#,##0;(#,##0);"-"`, header/total fills and column widths.
   - Add a grand-total row at the bottom summing each numeric column, styled with the totals fill (matches the reference template).
   - Keep the same 5-row header band, merges, frozen panes and landscape page setup. Sl.No numbering continues across groups.
   - `buildDlrMatrixWorkbook` / `downloadDlrMatrixXlsx` keep their signatures; a single item now produces the full sheet.

2. **`src/routes/reports.tsx`**
   - Replace the per-project `matrixItems` list with a single item built from the existing full `matrix` (the same one the preview and Excel download use), so the Matrix Format button exports one correct sheet named by the report date.

## Out of scope

Excel and CSV downloads, on-screen preview, filters, sorting, project labels and totals logic stay unchanged.
