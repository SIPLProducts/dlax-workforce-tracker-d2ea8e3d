## Goal
Enable multi-select in the Dashboard's Project filter while keeping the existing "All Projects" option. Dashboard KPIs, trend, breakdowns, leaderboards, "No entry today" card, and drilldowns should reflect the union of selected projects. Contractor/Department filters, date range, and all other behaviour stay unchanged.

## Changes — `src/routes/index.tsx`

### State
- Replace `projectId: string` with `projectIds: string[]` (empty array ≡ "All Projects").
- Update `SavedFilters`, `loadFilters()`, and the persistence effect to store `projectIds`. Migrate old saved values: legacy `projectId === "all"` or missing → `[]`; any other string → `[projectId]`.
- Update `resetFilters()` to set `projectIds` to `[]`.
- Change effect dependency arrays that referenced `projectId` to depend on `projectIds.join(",")` to avoid identity-based refetch loops.

### Data fetching
- `applyFilters(q)`: when `projectIds.length > 0`, apply `q.in("project_id", projectIds)`; else no project filter.
- Contractor/department filters untouched.

### Project filter UI
Replace the single `<Select>` with a multi-select popover built from existing shadcn primitives (`Popover` + `Command` from `@/components/ui/command` + `Checkbox`), following the pattern used by `src/components/ProjectCombobox.tsx`:
- Trigger button (`w-[220px]`) label:
  - `projectIds.length === 0` → "All Projects"
  - `=== 1` → `[code] name` of that project
  - `>= 2` → "N projects selected"
- Popover content:
  - Top row: "All Projects" checkbox — checked when `projectIds.length === 0`; selecting it clears the array (equivalent to Select All).
  - Search input (filters by code/name).
  - One checkable row per project showing `[code] name`; clicking toggles membership in `projectIds`.
- No new dependencies.

### Downstream consumers
No changes to memos — `stats`, `trendData`, `topProjects`, breakdown rollups, and drilldown queries all derive from `rows`/`todayRows`/etc., which are already filtered by `applyFilters`. Update the "No entry today" candidate list to restrict the full project master to `projectIds` when non-empty so the card reflects the selection.

## Verification
- Default state: "All Projects", totals match current dashboard.
- Selecting 2–3 projects updates KPIs, trend, top lists, and "No entry today" to just those projects.
- "All Projects" toggle clears the selection; Reset returns to All.
- Selection persists across reload (localStorage) and migrates cleanly from the old single-project format.
- Contractor/Department filters, range presets, Refresh, and drilldown remain functional.

## Files
- `src/routes/index.tsx` (only file modified)
