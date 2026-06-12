# Add "Sheet Type" column to Approvals

## Change
In `src/routes/approvals.tsx`, add a new column **Sheet Type** to the approvals table (rendered in all three tabs: My Approvals, My Submissions, All) showing whether the sheet originated from Daily Entry or OT Entry.

## Details
- Data already available: `sheet_type` on each `Sheet` row (`"ot"` or `null`/`"daily"`).
- Render as a Badge:
  - `sheet_type === "ot"` → "OT Entry" (amber/orange outline badge)
  - otherwise → "Daily Entry" (blue/slate outline badge)
- Add `<TableHead>Sheet Type</TableHead>` between **Sheet ID** and **Date**.
- Add matching `<TableCell>` in the row.
- Update the empty-state `colSpan` from 7 → 8.

## Out of scope
No DB changes, no logic changes, no changes to other screens or behavior.