## Goal
Extend the top Global Search to support two modes: **Menu** (navigate to screens) and **Data** (current record search), without disturbing existing record search.

## UX
- Inside the existing search dropdown panel, add a small toggle (segmented control) at the top: **Menu | Data**. Default = **Data** (preserves current behavior).
- Persist the selected mode in `localStorage` so it sticks across sessions.
- Placeholder text updates with mode: `Search menus…` vs `Search anything…`.
- The keyboard shortcut (⌘K) still focuses the input.

## Menu mode
- Source list: `APP_SCREENS` from `src/lib/screens.ts` (already the canonical screen registry, includes `label` + `path`).
- Filter screens by case-insensitive match on `label` OR `key` (so typing `OT` finds "OT Entry Sheet").
- Respect permissions: hide screens the current user cannot view. Use `usePermissions()` from `src/hooks/use-permissions.tsx` (same gate already used by sidebar/`ScreenGuard`).
- Render results under a single "Screens" group with a `LayoutGrid` icon. Selecting an item navigates via `navigate({ to: screen.path })` and closes the panel.
- Show "No matching screens." when empty; show all permitted screens when query is empty (so it works like a menu picker).

## Data mode
- Unchanged: existing `searchAll()` flow, groups (Projects, Contractors, Category of Labour, Categories, Sheets, Users), 2-char minimum, debounce, etc.

## Scope (files)
- Edit only `src/components/GlobalSearch.tsx`:
  - Add `mode` state (`"data" | "menu"`), persisted in `localStorage`.
  - Add segmented toggle inside the portal panel header.
  - Branch render: menu list vs existing data groups.
  - Import `APP_SCREENS` and `usePermissions`.
- No changes to routes, sidebar, screens registry, or data search logic.

## Out of scope
- No new screens added to `APP_SCREENS`.
- No changes to permission model, routing, or record search behavior.
- No schema/backend changes.
