## Plan

Fix the Global Search dropdown so it appears above the Daily Entry page header/filter/table content instead of being hidden underneath it.

### What I’ll change
1. Update `src/components/GlobalSearch.tsx` only.
2. Render the search results panel with `createPortal(..., document.body)` instead of keeping it inside the sticky TopBar/header DOM tree.
3. Keep the panel `position: fixed`, measured from the search input, but move it outside the TopBar stacking context so page cards, sticky filters, status badges, and table headers cannot cover it.
4. Use a very high z-index and fully opaque `bg-popover` surfaces for the panel, command container, and list.
5. Keep existing behavior unchanged:
   - Global Search query and grouping
   - Duplicate-result prevention
   - Keyboard shortcut `⌘K` / `Ctrl+K`
   - Escape close
   - Click-outside close
   - Selecting a result and navigating

### Technical details
- Import `createPortal` from `react-dom`.
- Build the dropdown JSX once, then portal it to `document.body` only when `open` is true.
- Continue using `wrapperRef.current.getBoundingClientRect()` for `top`, `left`, and `width`.
- Keep outside-click detection checking both the input wrapper and the portal panel by `id="global-search-panel"`.

### Verification
- On `/daily-entry`, type `pm` in Global Search and confirm the results appear on top of the Date/Project filter header, Daily Manpower Entry card, status badges, and table rows.
- Confirm non-highlighted dropdown rows have a solid background.
- Check other dense screens like `/masters/contractors` and `/reports` to ensure the dropdown still appears correctly.
- Confirm Escape and outside click still close the dropdown.