## Problem

The dashboard's "No entry today" card only shows 4 projects even though other projects also have no entries today. Root cause (verified in `src/routes/index.tsx` lines 270-278):

```ts
const projectsWithoutToday = useMemo(() => {
  const reportedToday = new Set(todayRows.map((r) => r.project_id));
  const activeIds = new Set(rows.map((r) => r.project_id));   // <-- only projects with activity in the selected period
  return Array.from(activeIds)
    .filter((id) => !reportedToday.has(id))
    .map((id) => projectMap.get(id))
    .filter(Boolean)
    .slice(0, 6);                                              // <-- hard cap of 6
}, [todayRows, rows, projectMap]);
```

Two bugs:
1. The candidate set is projects that had headcount in the current filter window (`rows`), so any project that hasn't been used in the last N days is silently excluded from the "no entry today" list.
2. `.slice(0, 6)` caps the display at 6 even when more projects are missing entries.

## Fix (UI/data only, no backend or logic changes elsewhere)

In `src/routes/index.tsx`:

1. Compute `projectsWithoutToday` from the full `projects` master list already loaded (respecting the current Project filter when set), instead of from `rows`:
   - If `projectId !== "all"`: candidate set = `[projectMap.get(projectId)]`.
   - Else: candidate set = all `projects` visible to the user (already RLS-scoped by `loadMasters`).
   - Optionally exclude projects whose `status` is inactive/closed if such a value exists — keep current behavior of "all visible projects" otherwise to match the user's expectation.
2. Remove the `.slice(0, 6)` cap so every project without a today entry is listed. Keep the flex-wrap badge layout so it stays readable.
3. Update the card title count to reflect the true number (already uses `projectsWithoutToday.length`, will now be accurate).

## Ensuring live/fresh data

The dashboard already refetches whenever filters change (`useEffect` on `dateFrom/dateTo/projectId/contractorId/departmentId`) and reads directly from Supabase with no client caching layer. To make "today" reliably fresh:

- Add a lightweight refresh on window focus and on tab-visibility change that re-runs `loadData()` (and `loadMasters()` if projects list can change), so returning to the tab shows current entries without a manual reload.
- Add a small "Refresh" button next to the range selector that calls `loadData()` + `loadMasters()` for on-demand refresh.

No changes to queries, RLS, schema, other cards, or business logic — only the candidate-set fix, slice removal, and refresh triggers.

## Files touched

- `src/routes/index.tsx` — only the `projectsWithoutToday` memo, plus focus/visibility refresh effect and a Refresh button in the header.
