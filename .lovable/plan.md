## Fix: Matrix Format DLR — Total column value missing

**Root cause.** In `src/lib/dlr-daily-matrix.ts` the data-row `Total` cell is written as an Excel formula (`=<subAddr>+<nmrAddr>`) with no cached value. `xlsx-js-style`/SheetJS does not compute formulas at write time, so Excel/Numbers display the cell as blank until the user forces a recalculation. The UI and plain Excel exports write a literal number, which is why they show correctly.

### Change

- `src/lib/dlr-daily-matrix.ts`
  - Replace the `fml(...)` write at `totalCol` with `num(subTotal + nmrTotal, { fill: FILL_TOTALS, font: FONT_B })` so the value is present without needing recalculation. Drop the now-unused `fml` helper and stale `subAddr`/`nmrAddr`/`rr` locals.

No other files change. Data model, header layout, merges, and column widths stay identical.
