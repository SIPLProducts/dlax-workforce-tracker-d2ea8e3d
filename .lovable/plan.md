## Goal

Replace the small text-only View dialog in Approvals with the same full sheet view used on the Daily Entry page (project header, date, contractors × dept/category grid, remarks, weather, totals), in read-only mode.

## Approach

Reuse the existing rendering in `src/routes/daily-entry.tsx` by navigating to it with query params, rather than duplicating the grid logic in Approvals. Daily Entry already supports view mode and shows everything we need; we just need it to deep-link to a specific sheet.

## Changes

1. **`src/routes/daily-entry.tsx`**
   - Add `validateSearch` to the route to accept optional `project` (uuid) and `date` (yyyy-MM-dd) params.
   - On mount, if both params are present: preselect that project, set the date, and force `mode = "view"` (do not auto-enter edit even if the sheet is a draft).
   - No changes to existing entry/edit/save/send logic for users who land on `/daily-entry` without params.

2. **`src/routes/approvals.tsx`**
   - Replace the current `Eye` button handler: instead of `setViewing(s)`, use `useNavigate()` to push `/daily-entry?project=<project_id>&date=<entry_date>`.
   - Remove the now-unused `viewing` state and the small View `<Dialog>` block. Keep the Reject dialog and approval levels info as-is.
   - The approval-levels / submitter / rejection-remarks info that the old dialog showed will be available on the Daily Entry page (it already renders sheet status, submitter, approver chain, and rejection remarks for the active sheet — verified in `DailyEntryPage`).

3. **No backend / RLS / schema changes.** Approvers already have read access to sheets they can act on; project-scoped RLS continues to apply.

## Out of scope

- No change to Approve/Reject buttons or workflow.
- No change to the Daily Entry edit/save behavior.
- No new component extraction — we reuse the page directly.
