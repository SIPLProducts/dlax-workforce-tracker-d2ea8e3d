## Problem

On the Daily Entry sheet (`src/routes/daily-entry.tsx`):

1. Horizontal lines between some contractor rows (e.g. between Sl.no 18 and 19) disappear.
2. While scrolling vertically/horizontally, the sticky left columns (Sl.no, SC Code, Name, Contact, Work Place) and sticky header rows visually drift / overlap rows below.

Both come from the same root cause: the table uses `border-collapse: collapse` while several `<th>` / `<td>` cells are `position: sticky`. With collapsed borders, the border belongs to the table, not to the cell — so when a sticky cell paints over the scrolling area it covers the row's bottom border, leaving gaps that look random (more visible on rows whose content is empty/short, like row 18 in the screenshot). The same overlap is why headers/columns look misaligned mid-scroll.

## Fix (scoped to `src/routes/daily-entry.tsx`, entry-sheet table only)

Switch the entry-sheet table to a separated-border model so borders belong to each cell and stay attached to it while sticky:

1. Change the `<table>` class from `border-collapse text-xs w-full min-w-[1600px]` to `border-separate border-spacing-0 text-xs w-full min-w-[1600px]`.
2. Replace the per-cell `border` utility (which renders 4 sides and doubles up under `border-separate`) on `<th>` and `<td>` in this table with directional borders so each cell draws exactly one shared edge:
   - Header cells (top row): `border-b border-r` (+ keep existing `border-r-2 border-r-slate-300` on Work Place divider).
   - Second header row (categories): `border-b border-r`.
   - Body cells: `border-b border-r`.
   - Footer (TOTAL) row cells: `border-t border-r`.
   - First column (`Sl.no` / index) also gets `border-l` so the left edge is visible.
3. Keep all existing `sticky`, `z-*`, `bg-*`, `bg-clip-padding`, `box-border`, width, and `border-r-2 border-r-slate-300` classes untouched — only swap `border` → directional borders.
4. Outer wrapper `<div className="overflow-auto rounded-md border" …>` already supplies the outer frame, so no double border appears.

This guarantees every row keeps its bottom border even when a sticky cell paints over it, and sticky columns stay visually aligned with their rows during scroll. No logic, data, layout offsets, or other screens are touched.

## Out of scope

- Saved Entries table, OT Entry, Reports, and any other screen.
- Column widths, sticky offsets, header heights, business logic, data shape.
