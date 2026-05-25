## Problem

On the Entry Sheet tab, the four frozen columns (Sl.no, Name of the Contractor, Contact No, Work Place) show visible gaps / misalignment between header, body, and TOTAL rows. The sticky `left-*` offsets (`left-0`, `left-12`, `left-[268px]`, `left-[388px]`) are mathematically correct against the declared widths (48 + 220 + 120 + 160), but because the table uses auto layout, cell padding (`px-2`) and long contractor names cause the actual rendered column widths to exceed the declared `w-*` values. The sticky offsets stay fixed at the declared values, so the next frozen column either overlaps or leaves a gap.

## Fix (UI-only, single file)

Edit `src/routes/daily-entry.tsx`, Entry Sheet table only:

1. Add a `<colgroup>` right after `<table>` that pins explicit widths for the first 4 columns:
   - col 1: 48px (Sl.no)
   - col 2: 220px (Name of the Contractor)
   - col 3: 120px (Contact No)
   - col 4: 160px (Work Place)
2. Add `box-border` to every frozen `<th>` / `<td>` (header row, body rows, TOTAL row) so `px-2` padding is included inside the declared width instead of expanding it.
3. Add `truncate` (with `title={...}` for the contractor name cell) so long company names cannot stretch the column past 220px.
4. Keep the existing `left-0 / left-12 / left-[268px] / left-[388px]` offsets — they become exact once the colgroup enforces widths.
5. Re-verify the three rows that have sticky cells stay in sync: header row (line ~573), body row (line ~599), tfoot TOTAL row (line ~633).

No data, schema, permission, or backend changes. Only the Entry Sheet table markup inside `src/routes/daily-entry.tsx`.
