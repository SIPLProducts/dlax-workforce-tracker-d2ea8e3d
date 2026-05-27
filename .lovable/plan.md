## Problem

On Daily Entry, sticky `<th>` cells use viewport offsets (`top-[144px]`), but the table sits inside `TableWithTopScroll`'s `overflow-x-auto` div — which becomes the sticky scroll context yet has no height limit. Result: the page scrolls (not the container), the header ends up "floating" mid-page and overlapping rows (Image 2). Image 3 is the goal: page chrome fixed, only the table body scrolls.

## Fix — `src/routes/daily-entry.tsx` only

### Entry Sheet spreadsheet
- Replace the `TableWithTopScroll` wrapper around the spreadsheet `<table>` with a single scroll container:
  `<div className="overflow-auto rounded-md border" style={{ maxHeight: 'calc(100vh - 320px)' }}>`
- Make `<thead>` itself sticky: `className="sticky top-0 z-20 bg-slate-100"`.
- Remove `top-[112px] md:top-[144px]` from every `<th>` (viewport offsets are wrong inside a real scroll container).
- Row 2 (category cells) gets `top-[36px]` so it pins just below row 1.
- Keep `left-0 / left-[48px] / left-[148px] / left-[368px] / left-[488px]` on the 5 pinned columns; bump their header z to `z-30` (sticky-top × sticky-left intersection) and body pinned cells stay `z-10`.

### Saved Entries table
- Wrap in `<div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>`.
- Change its `<TableHeader>` sticky class from `top-[112px] md:top-[144px]` to `top-0`.

### Cleanup
- The mirrored top horizontal scrollbar (`TableWithTopScroll`) is no longer needed for this screen — the new container's native bottom scrollbar handles horizontal scroll. The component definition can remain in the file (unused) to avoid touching unrelated callers.

## Out of scope

- Master pages (already adjusted in a previous turn).
- No business logic, query, RLS, or data-shape changes.
- No layout/page-chrome changes.

## Trade-off

`max-height: calc(100vh - 320px)` is a fixed estimate of TopBar (56) + PageHeader (~88) + Date/Project card (~110) + Tabs (~46) + paddings. If those heights change later, the constant needs a tweak. A `ResizeObserver` measurement is possible but adds complexity for marginal gain.
