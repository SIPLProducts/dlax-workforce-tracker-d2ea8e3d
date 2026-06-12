## Goal
Replace the single Menu/Data toggle in the top bar with **two separate search fields side by side**: a Menu Search and a Data Search.

## UX
- Top bar shows two compact inputs:
  - **Menu Search** — placeholder `Search menus…`, magnifying-glass + `LayoutGrid` accent icon.
  - **Data Search** — placeholder `Search anything…`, with the existing ⌘K shortcut chip.
- Each has its own dropdown panel (independent open/close, independent query state).
- On mobile, stack them or keep the Data one visible and put Menu in a slimmer width — both remain usable.
- ⌘K still focuses the **Data** input (preserves current shortcut behavior).

## Behavior
- **Menu Search**: filters `APP_SCREENS` (from `src/lib/screens.ts`) by label/key, respects `usePermissions().canView`. Empty query shows all permitted screens. Selecting navigates via `navigate({ to: screen.path })`.
- **Data Search**: unchanged — debounced `searchAll()`, 2-char minimum, all existing groups (Projects, Contractors, Category of Labour, Categories, Sheets, Users) and navigation behaviors.

## Scope (files)
- `src/components/GlobalSearch.tsx` — split the current component into two internal subcomponents (`MenuSearch`, `DataSearch`) and export a wrapper `GlobalSearch` that renders both in a flex row. Remove the Menu/Data toggle UI and the persisted `mode` state added previously.
- `src/components/TopBar.tsx` — no API change needed (still imports `GlobalSearch`). Only adjust width/layout if the two fields need more room.

## Out of scope
- No changes to data search logic, route registry, or permissions.
- No new screens or schema changes.
