## Problem

On the Dashboard (`src/routes/index.tsx`) the date-range pills, Reset, and Refresh don't behave predictably:

- **Reset doesn't visibly refresh.** Reset only calls state setters. When the filters are already at defaults (30d, All projects/contractors/departments/status), nothing meaningful changes, so the user sees no reload. There is no explicit "reload now" trigger.
- **Range snaps back to 30d.** The selected range is kept only as `rangeDays` plus two separate `Date` values that are never persisted. The saved-filter reader rebuilds the dates from `rangeDays` on every mount, and any code path that re-derives them (remount, custom-date path writing `rangeDays: 0` → saved as `30`) lands back on a 30-day window. So after picking **Today** and hitting Refresh, the dashboard can re-derive the 30-day window.

## Fix

All changes stay inside the Dashboard route's filter/refresh layer — queries, cards, and other pages are untouched.

1. **Single source of truth for the range.** Keep `rangeDays` and derive `dateFrom`/`dateTo` from it in one helper that always normalises to start/end of day. Custom dates set `rangeDays: 0` and keep their own explicit dates.
2. **Persist the actual window.** Save `dateFrom`/`dateTo` as ISO date strings alongside `rangeDays` in the stored filters, and restore them on mount instead of recomputing from `rangeDays`. When `rangeDays > 0`, re-anchor the window to the current date on mount (so "Today" stays today the next day) but never silently swap the selected pill to 30d. Stop rewriting `rangeDays: 0` as `30` in storage.
3. **Explicit refresh trigger.** Add a `refreshKey` counter to the data-loading effect's dependencies. Both the **Refresh** button and **Reset** bump it, so data always re-fetches even when the filter values are unchanged. Refresh never touches `rangeDays` or the dates.
4. **Reset semantics.** Reset returns filters to defaults (30d, all projects/contractors/departments, status All) *and* bumps `refreshKey`, guaranteeing a visible reload.
5. Add a lightweight in-flight guard so overlapping loads (button click + window focus listener) can't apply stale results out of order.

## Verification

- Select **Last 30 Days** → **Reset**: network calls fire and the cards re-render with fresh values.
- Select **Today** → **Refresh**: the Today pill stays active, the subtitle keeps today's date on both From and To, and only the data reloads.
- Reload the page after picking Today: Today stays selected.
- Custom From/To dates survive Refresh and remain marked as a custom range.
