## Goal

Add a "Draft" option to the Status filter in Reports (Daily, Daily Labour Report, Summary, Weekly), showing only draft records from the backend.

## Change (single file: `src/routes/reports.tsx`)

1. Extend the shared filter type `ApprovalStatusFilter` to include `"draft"`.
2. In `applyApprovalStatus`, add `if (s === "draft") return q.eq("status", "draft")` — the same live-query approach already used for pending/approved, no hardcoded data.
3. Add a `Draft` item to `ApprovalStatusSelect` (order: All, Draft, Pending, Approved).

Because all four tabs already share the same `approvalStatus` state, the same helper, and the same select component, the option becomes available and functional everywhere at once.

## Not changing

Default remains "All"; reset behaviour, queries, exports, and every other filter stay as-is.
