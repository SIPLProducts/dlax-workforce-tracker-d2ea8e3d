## Goal

On the Daily Manpower Entry sheet, freeze the left identification columns (Sl.no, Name of the Contractor, Contact No, Work Place) so they stay visible while the user scrolls horizontally through the CIVIL / MEP / NMR data columns. Today only Sl.no and Name of the Contractor are sticky — Contact No and Work Place scroll away.

## Scope

Single file: `src/routes/daily-entry.tsx` — the manpower entry table only. No DB / logic changes, no other screens touched.

## Changes

1. Convert the 4 identification columns to sticky columns with explicit `left` offsets and fixed widths:
   - Sl.no — `w-12`, `left-0`
   - Name of the Contractor — `w-[220px]` (was `min-w-[200px]`), `left-12`
   - Contact No — `w-[120px]` (was `min-w-[110px]`), `left-[232px]`
   - Work Place — `w-[160px]` (was `min-w-[140px]`), `left-[352px]`
   - Total frozen pane width ≈ 512px.

2. Apply sticky + matching `left` to:
   - Header `<th>` cells in row 1 (with `z-20` so they stay above body)
   - Body `<td>` cells for every contractor row (with `z-10` and solid `bg-background` so scrolling data underneath doesn't bleed through)
   - Footer TOTAL row cells covering the same 4 columns (solid `bg-yellow-100`)

3. Keep the existing vertical sticky header (row 1 + row 2 of `<thead>`) intact. The page-level `PageHeader` and the synced top scrollbar above the table are already sticky and stay as-is.

4. Make sure right-side borders on the last frozen column (`Work Place`) render above scrolling cells so the freeze edge is visually clear (use `border-r-2 border-slate-300` on the 4th sticky column only).

## Technical notes

- Sticky offsets must be exact pixel values (Tailwind arbitrary classes like `left-[232px]`) because the columns are fixed widths; percentage-based widths won't align header vs body.
- Body cells need an opaque background (`bg-background`) or the columns behind them will show through during horizontal scroll.
- The footer TOTAL row currently uses `colSpan={2}` for the first two cells and an empty `colSpan={2}` for Contact No + Work Place. Split these into 4 individual cells so each can carry its own sticky offset.
- No new dependencies, no schema changes, no route changes.

## Out of scope

- Other tables (Saved Entries, Reports, Approvals).
- Vertical row freezing.
- Resizable columns.