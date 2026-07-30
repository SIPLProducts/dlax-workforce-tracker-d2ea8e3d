## Goal

On the Dashboard, support Draft / Pending / Approved approval statuses and show a dedicated card with the live count and project list per status.

## What exists today (verified)

`src/routes/index.tsx` already has a Status filter with All / Pending / Approved. It filters `daily_manpower` rows by `status` (`approved`, or `pending_l1`/`pending_l2`) inside `applyFilters`, and the choice is persisted in saved filters. There is no Draft option and no per-status summary card.

## Changes

1. **Add Draft to the existing Status filter**
   - Extend the filter value set to `all | draft | pending | approved`, including the saved-filter type, the localStorage read/validate step, and reset.
   - In `applyFilters`, Draft filters rows with status `draft`. Pending stays `pending_l1`/`pending_l2`; Approved stays `approved`.

2. **New "Approval Status" card (separate card, placed under the KPI row)**
   - Loads live from the backend for the currently selected date range, projects, contractor and department — but ignoring the status filter itself, so all three buckets are always visible.
   - Shows three rows: Draft, Pending, Approved, each with:
     - entry/headcount count for that status,
     - the list of distinct projects that have data in that status (shown as badges, same style as the "No entry" card).
   - Clicking a status row applies that status to the Status filter; clicking a project badge opens the existing project drill-down.
   - Counts and project names come purely from the query result and the loaded project master — no hardcoded numbers or project names.

3. **Refresh behaviour**
   - The new query is loaded in the same `loadData` pass, so it updates with date/project/contractor/department changes, window focus, and the Refresh button, exactly like the other dashboard data.

## Not changing

Existing KPIs, top lists, trend chart, no-entry alert, drill-downs, Reports screen, and all backend/database logic remain untouched.

## Verification

- With Status = Draft, the dashboard totals show only draft rows.
- The Approval Status card totals across the three buckets equal the unfiltered period total.
- Draft sheets (e.g. DE-000076 "Testing") appear only under Draft, not Approved.
