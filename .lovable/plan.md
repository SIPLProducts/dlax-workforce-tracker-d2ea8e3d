## Goal
Add an **Approval Status** filter to the Dashboard and Reports screens with three options: **All** (default), **Pending**, and **Approved**. When set, all `daily_manpower` queries on that screen filter by the selected status; every other behavior stays as-is.

Status mapping (uses existing `approval_status` enum on `daily_manpower.status`):
- **Approved** → `status = 'approved'`
- **Pending** → `status IN ('pending_l1','pending_l2')` (data not yet approved and not draft/rejected)
- **All** → no status filter

## Dashboard — `src/routes/index.tsx`
- Add `approvalStatus: "all" | "pending" | "approved"` state, persisted to the same localStorage filter blob used by the other filters (with migration for older payloads defaulting to `"all"`).
- Add a `Select` control in the filter row (next to Department) labeled **Status** with options All / Pending / Approved. Include it in the Reset action.
- Extend the shared `applyFilters` helper (used for the 4 `daily_manpower` reads around line 259-266) so that when `approvalStatus !== "all"` it appends:
  - `.eq("status","approved")` for Approved
  - `.in("status",["pending_l1","pending_l2"])` for Pending
- The "No entry today" card queries projects, not manpower, so it stays unchanged.

## Reports — `src/routes/reports.tsx`
Add a single `approvalStatus` state at the page level, rendered as a **Select** in each tab's filter bar (Daily, Daily Labour Report, Weekly, Summary), placed alongside the existing project/contractor/department filters. Apply the same enum mapping to every `daily_manpower` query:
- Line ~127 (Daily preview list)
- Line ~448 (DLR fetch)
- Line ~620 (Weekly fetch)
- Line ~1055 (Summary fetch)

Each call gets a small helper (local to the file) `applyStatus(q)` returning the builder with `.eq` / `.in` applied when needed, typed via the `sel` string-widening pattern to keep TS fast.

## Preserved
- No schema changes; uses existing `status` column.
- Other filters, previews, PDF/Excel exports, approval workflow, and the "No entry today" card behavior unchanged.
- Default is **All**, so current outputs match today.

## Verification
- Dashboard: switching Status to Approved reduces KPIs to approved rows only; Pending shows only pending_l1/pending_l2; All matches previous totals.
- Reports Daily/DLR/Weekly/Summary previews and their downloaded files reflect the selected status.
- Reset restores Status to All along with other filters.
- Selection persists across reload on Dashboard (localStorage).

## Files
- `src/routes/index.tsx`
- `src/routes/reports.tsx`