# Global Search in Top Bar

Add a search input in the `TopBar` (visible on every screen) that lets users find Projects, Contractors (incl. SC code & contact), Departments (Category of Labour), Categories, and Daily Entry sheets (DE-number). Selecting a result navigates to the matching screen with the row highlighted/filtered. No existing behaviour on any screen is changed.

## UX

- Search input (with `Search` icon, `Cmd/Ctrl+K` shortcut) placed in `TopBar` between the breadcrumb and the theme switcher; collapses to an icon-button on mobile that opens the same dialog.
- Click or shortcut opens a `CommandDialog` (shadcn `command`) with grouped results:
  - Projects (name, code)
  - Contractors (name, SC code, contact)
  - Departments / Category of Labour (name, code)
  - Categories (name, code)
  - Daily Entry Sheets (DE-number, project, date)
- Debounced query (~250 ms), min 2 chars, max 8 results per group. Empty state, loading skeleton, "no results" copy.
- Respect RLS — uses the user's session, so each user only sees what they can already access (project scoping kicks in automatically for sheets and project-scoped data).

## Navigation targets (highlight via `?highlight=<id>`)

| Entity | Route | Highlight behaviour |
|---|---|---|
| Project | `/masters/projects?highlight=<id>` | Scroll row into view + brief ring highlight |
| Contractor | `/masters/contractors?highlight=<id>` | Same |
| Department | `/masters/departments?highlight=<id>` | Same |
| Category | `/masters/categories?highlight=<id>` | Same |
| Daily Entry sheet | `/daily-entry?project=<projectId>&date=<YYYY-MM-DD>` (existing deep-link) | Opens sheet in View mode (already supported) |

Each masters screen reads `highlight` from search params, scrolls the matched row into view, and applies a 2s `ring-2 ring-primary` pulse, then clears the param. No other logic touched.

## Implementation

New files:
- `src/components/GlobalSearch.tsx` — button + `CommandDialog`, debounced query, groups, keyboard shortcut, navigation.
- `src/lib/global-search.ts` — single `searchAll(term)` helper running parallel Supabase queries with `ilike` on relevant columns + `eq` on codes; for sheets joins `daily_manpower_sheets` to `projects` and filters by `sheet_no` (DE-number) or project name/code.

Edits (minimal, additive):
- `src/components/TopBar.tsx` — render `<GlobalSearch />` in the right-hand cluster (and a compact trigger for mobile). No other changes.
- `src/routes/masters.projects.tsx`, `masters.contractors.tsx`, `masters.departments.tsx`, `masters.categories.tsx` — add `validateSearch` for optional `highlight`, a small `useEffect` that scrolls `data-row-id={id}` into view and toggles a highlight class, then clears the param via `navigate({ search: {} , replace: true })`. Add `data-row-id` to each row.
- No DB changes; existing RLS already restricts results appropriately.

## Out of scope (confirmed)

- Individual employees/workers (per-worker attendance) — not included; "employee" is treated as contractor as you selected.
- Inline detail modals — not used; navigation-with-highlight only.

## Validation

- Open from any screen via icon click or `Ctrl/Cmd+K`.
- Search "SC9035" → contractor result → lands on `/masters/contractors` with that row highlighted.
- Search "BHELSTPP" → project result → lands on `/masters/projects` highlighted; contractor results filtered by project scope still appear.
- Search "DE-000048" → opens that sheet in Daily Entry View mode.
- Verify a non-admin user only sees results within their assigned projects.
- Confirm Daily Entry, Approvals, and all other existing flows are unchanged.
