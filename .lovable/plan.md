## Plan

Update only `src/components/GlobalSearch.tsx` so the search results render as a true top-layer overlay above the Daily Entry sticky filter card and table headers.

### Changes
1. Replace the current in-flow absolute dropdown with a fixed-position overlay panel calculated from the search input’s screen position.
2. Use a much higher z-index than the Daily Entry sticky filter/header/table layers so results stay above the whole screen content.
3. Keep the dropdown visually attached below the search field, but render it outside the TopBar stacking context to avoid being covered by page sections.
4. Keep the existing search behavior unchanged: query loading, grouping, deduplication, keyboard shortcut, Escape close, click-outside close, and result navigation.

### Technical details
- Add lightweight state for `{ top, left, width }` panel coordinates.
- Measure `wrapperRef.current.getBoundingClientRect()` when opening, typing, scrolling, resizing, and while results are visible.
- Change the results container from `absolute left-0 right-0 top-full ... z-[100]` to a `position: fixed` overlay using inline `top/left/width` and a higher z-index such as `z-[1000]`.
- Keep `bg-popover` on the panel, `Command`, and `CommandList` so non-highlighted rows remain fully opaque.

### Verification
- On `/daily-entry`, typing `pm` in Global Search should show the dropdown above the Date/Project filter card, status badges, and table area.
- Check `/masters/contractors` and `/reports` to confirm the dropdown still appears below the search input and above dense page content.
- Confirm Escape and outside click still close the dropdown.