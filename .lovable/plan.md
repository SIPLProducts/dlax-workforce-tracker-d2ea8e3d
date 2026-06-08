## Problem
In `src/routes/daily-entry.tsx`, the 5 frozen left columns use hardcoded `left-[0|48|148|368|488]px` offsets that assume widths of `48 / 100 / 220 / 120 / 160`. Those widths live only in `<colgroup>`, which browsers treat as a hint. Actual rendered widths drift with content, so when the user scrolls horizontally:
- gaps open between two sticky columns and the scrolling non-sticky headers (e.g. "Struc Ste Wo") show through, or
- sticky columns visually overlap each other.

## Fix (single file: `src/routes/daily-entry.tsx`)
Pure CSS — no data or behaviour changes.

1. **Pin widths on every sticky cell.** Add `style={{ width:N, minWidth:N, maxWidth:N }}` on each sticky `<th>` (header rows) and `<td>` (body + tfoot TOTAL row) for the 5 frozen columns, matching the colgroup: 48 / 100 / 220 / 120 / 160. Keep `box-border` so the border doesn't expand the box.
2. **Seal seams.** Add `bg-clip-padding` on sticky body cells so the background paints under the border, preventing 1px peek-through at column seams during scroll.
3. **Layer the right divider.** Bump the `Work Place` sticky cell (header, body, tfoot) to `z-30`/`z-40` so its `border-r-2` always paints over any scrolled non-sticky cell crossing the boundary.
4. **TOTAL row (tfoot).** Apply the same width pinning to its 5 sticky `<td>`s.

## Width map
```text
Column         colgroup width   sticky left    pin to
Sl.no              48              0           w/min/max = 48
SC Code           100             48           w/min/max = 100
Name              220            148           w/min/max = 220
Contact No        120            368           w/min/max = 120
Work Place        160            488           w/min/max = 160  (+ raised z)
```

## Out of scope
- No change to non-sticky right-side columns, totals logic, data fetching, or styling of department/category groups.
- No change to vertical sticky header behaviour.
