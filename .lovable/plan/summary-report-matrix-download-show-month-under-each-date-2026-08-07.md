# Summary Report Matrix download: show month under each date

On screen, each day column shows the day number with the month abbreviation (e.g. "1" above "AUG") beneath it. The Matrix Format Excel download currently prints only the day number, so month context is lost when a range spans two months.

## Change

In the Matrix Format workbook builder (`src/lib/summary-matrix-xlsx.ts`):

- Add one extra header row directly below the day-number row that prints the month abbreviation (uppercase, e.g. `AUG`) for each day column, centered and styled like the header band.
- Week-average and month-total columns keep their existing labels, now merged vertically across the day-number and month rows so their text stays centered; the same vertical merge applies to `S.No`, `Project Name`, and `Remarks`.
- Shift all body rows, group bands and the Grand Total row down by one row, and update the sheet range accordingly.
- Update the frozen pane split so the new month row is included in the frozen header, and give the new row a small row height.

Nothing else changes: column widths, fills, number formats, sorting, totals, sheet name, and the on-screen table and CSV/other downloads stay as they are.
