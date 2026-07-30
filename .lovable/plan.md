## Goal

On the Dashboard's Approval Status card, when Draft / Pending / Approved is selected, show only that status's project list, and keep the card compact regardless of how many projects there are.

## Current behaviour (verified in `src/routes/index.tsx`)

The card renders all three buckets (`statusBreakdown`, built from the live backend query) side by side, each with its full project badge list inline. With many projects the badges wrap endlessly and the card grows tall. Selecting a status only adds a ring highlight; every bucket still shows its projects.

## Changes (all in `src/routes/index.tsx`, presentation only)

1. **Selected-status-only project list**
   - Keep the three status tiles (label, headcount, entry count) always visible so counts stay comparable.
   - Render the project badge list only for the currently selected status (`approvalStatus` = draft / pending / approved). When the filter is `all`, no badge list is shown, just the three counts and a hint to pick a status.
   - Clicking a tile selects that status (and toggles back to `all`), unchanged from today.

2. **Compact, scrollable project list**
   - Move the selected status's projects into a bounded region below the tiles: a scrollable area with a fixed max height (~140px) so the card never grows.
   - When the list exceeds a small threshold (e.g. 12 projects), show the first ones plus a "View all N projects" button that opens a dialog with a search box and a scrollable full list.
   - Project badges keep their existing click-to-drill-down behaviour in both the inline list and the dialog.

3. **Data**
   - No query changes: counts and project names continue to come from the existing live `statusBreakdown` query and loaded project master. No hardcoded values.

## Not changing

Status filter semantics, dashboard queries, KPIs, top lists, no-entry card, drill-downs, Reports.
