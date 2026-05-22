## Goal
Replace the legacy L1/L2 dropdowns on the Project Approvals master screen with a dynamic, ordered, multi-level approver editor backed by `project_approval_levels`. This makes the "Send to Approval" routing on Daily Entry actually configurable per project with N levels.

## What's already done (no change needed)
- DB: `project_approval_levels`, `sheet_approval_history`, `submit_sheet` / `approve_sheet` / `reject_sheet` RPCs, sequential routing, RLS.
- Daily Entry: View / Edit / Send to Approval buttons, sheet code (DE-000001), status badge "Pending — Level X/Y (Approver)", lock on approved/pending, saved-records table below.
- Approvals queue: only current-level approver sees the sheet.

## What's missing → this plan
The Project → Approvals screen (`src/routes/masters.approvals.tsx`) still binds to `project_approval_config.l1_user_id` / `l2_user_id`. So users cannot add a 3rd level, cannot reorder, cannot label levels — i.e. the multi-level config "is not reflected" in the UI.

## Changes

### `src/routes/masters.approvals.tsx`
Replace the L1/L2 column UI with a per-project **Levels editor**:

- Load `project_approval_levels` for all projects in one query, group by `project_id`, sort by `level_no`.
- Card view: each project card shows
  - Enable Approval switch (writes `project_approval_config.approval_enabled` — keep this row).
  - A vertical list of levels: `Level N  [Label input]  [Approver dropdown]  [↑] [↓] [🗑]`.
  - `+ Add Level` button appends a new level (level_no = current max + 1), default label "Level N", approver unset.
  - Save button per project — persists the levels array (delete missing rows, upsert by `(project_id, level_no)`) inside a single transaction-style sequence, then refreshes.
- Table view: collapse the levels into a single "Approvers" cell showing `L1: name → L2: name → L3: name`, with an "Edit levels" button opening a dialog that hosts the same editor.
- Drop the `L1 (PC)` / `L2 (PM)` columns and the bulk "Set L1 / Set L2" actions (replace with a generic "Enable approval / Disable approval" bulk action only — multi-level bulk-assignment is out of scope).
- Validation on save: every level must have an approver; level_no must be contiguous 1..N (auto-renumber on reorder/delete).
- Filters: keep `enabled / disabled`; drop `no_l1 / no_l2` (no longer meaningful). Add `no_approvers` (enabled but 0 levels) instead.

### Persist logic (client → DB)
On Save per project:
1. Upsert `project_approval_config` (approval_enabled).
2. Fetch existing `project_approval_levels` for the project.
3. Delete rows whose `level_no` no longer exists in the editor.
4. Upsert remaining rows by `(project_id, level_no)` with new approver/label.
5. Re-fetch to confirm.

### Out of scope
- No DB migrations (schema already supports this).
- No changes to Daily Entry, Approvals queue, or RPCs.
- Notifications / email still out of scope.
- Bulk multi-level assignment.

## Files
- `src/routes/masters.approvals.tsx` — replace L1/L2 UI with dynamic Levels editor (card + table + dialog).

## Acceptance
- On a project, I can click **+ Add Level** repeatedly to add level 1, 2, 3, … each with a custom label and a single approver.
- I can reorder and delete levels; numbering stays contiguous.
- After Save, opening Daily Entry for that project, picking a date, saving rows, then clicking **Send to Approval** routes the sheet to Level 1's approver only. After they approve, it auto-advances to Level 2's approver. The Daily Entry status badge shows "Pending — Level 2/3 (Name)".
- Only the assigned approver for the current level sees the sheet in the Approvals queue.
