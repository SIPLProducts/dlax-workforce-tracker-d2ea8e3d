## Goal

Replace the fixed L1/L2 approval model with a configurable N-level sequential approval per project. The Daily Entry screen exposes View / Edit / Send to Approval, and approval requests route only to the user assigned to the current level — no one else.

## Database changes

1. **New `project_approval_levels` table** (one row per level per project):
   - `project_id`, `level_no` (smallint, 1..N), `approver_user_id` (uuid → profiles.user_id), `label` (text, optional e.g. "Project Coordinator")
   - unique (`project_id`, `level_no`)
2. **`daily_manpower_sheets`** additions:
   - `current_level` smallint (0 = draft, 1..N = pending that level, N+1 = approved)
   - `total_levels` smallint (snapshot of level count at submission)
   - `status` enum already exists: keep `draft / pending / approved / rejected` (rename `pending_l1/l2` usage to single `pending`, with `current_level` indicating which step).
3. **New `sheet_approval_history` table** — append-only audit:
   - `sheet_id`, `level_no`, `approver_user_id`, `action` ('approve'|'reject'), `remarks`, `action_at`.
4. **Replace `is_project_l1` / `is_project_l2`** with `is_project_level_approver(_user, _project, _level)` and `is_current_sheet_approver(_user, _sheet)` (security definer). Drop old L1/L2 helpers after migration.
5. **Auto-migrate existing config**:
   - For every row in `project_approval_config` with `approval_enabled=true`: insert level 1 = `l1_user_id`, level 2 = `l2_user_id` (if not null) into `project_approval_levels`.
   - Keep `project_approval_config.approval_enabled` flag (controls whether approval is required at all). Drop `l1_user_id`/`l2_user_id` after backfill.
6. **RLS updates**:
   - `daily_manpower_sheets` UPDATE: status transition from `pending` allowed only if `is_current_sheet_approver(auth.uid(), id)`.
   - `daily_manpower` UPDATE: same lock as today (draft/rejected for editors).
   - `sheet_approval_history`: INSERT only via SECURITY DEFINER function `approve_sheet` / `reject_sheet`.

## Server-side logic

Two RPC functions (SECURITY DEFINER) so routing is enforced server-side, not in UI:

- `submit_sheet(sheet_id)` — caller must own sheet + have `daily_entry` edit; sets `status='pending'`, `current_level=1`, `total_levels=count`. If no levels configured or approval disabled, sets `status='approved'` directly.
- `approve_sheet(sheet_id, remarks)` — caller must equal approver at `current_level`. Appends history; if `current_level == total_levels` → `status='approved'`, else `current_level += 1`.
- `reject_sheet(sheet_id, remarks)` — caller must equal approver at `current_level`. Appends history; sets `status='rejected'`, `current_level=0`.

This guarantees the approval request is actionable **only** by the assigned approver for the current level.

## Approval Settings UI (`src/routes/masters.approvals.tsx`)

Per project card:
- **Approval Workflow** toggle (existing).
- **Levels list** (replaces the static L1/L2 dropdowns):
  - Rows show `Level 1`, `Level 2`, … each with an optional label input + approver user dropdown + delete (✕) button.
  - **+ Add Level** button appends Level N+1.
  - Reorder via up/down arrows (renumbers).
- **Save** persists `project_approval_levels` for the project (replace-all).
- Validation: at least one level required when approval enabled; each level must have an approver.

## Daily Entry UI (`src/routes/daily-entry.tsx`)

Action bar above the sheet:
- **View** button — read-only mode.
- **Edit** button — enabled only when `status ∈ draft / rejected`. Disabled with tooltip when `pending` ("Awaiting Level X approval") or `approved` ("Approved — locked").
- **Save** — upserts sheet + rows as `draft`.
- **Send to Approval** — visible when `status ∈ draft / rejected` and project has approval enabled with ≥1 level. Calls `submit_sheet` RPC; toast shows "Sent to {Level 1 approver name}".
- Status badge shows e.g. `Pending — Level 2 (harshini)`.

## Approvals queue (`src/routes/approvals.tsx`)

- Query sheets where `status='pending'` AND `is_current_sheet_approver(auth.uid(), id)`.
- Users only see sheets where they are the approver for the **current** level. No other levels, no other users.
- Approve / Reject buttons call the RPCs above.
- History panel shows each level's action from `sheet_approval_history`.

## Out of scope

- Parallel/multi-user-per-level approvals (chose single user, sequential).
- Notifications/email — only in-app queue and toasts.
- Editing levels mid-approval: changing levels on a project does not affect sheets already in flight (they use snapshot `total_levels`; approver lookup still uses the live `project_approval_levels` table for the matching `level_no`).

## Files touched

- New migration: `project_approval_levels`, `sheet_approval_history`, sheet columns, new helper funcs, `submit_sheet`/`approve_sheet`/`reject_sheet` RPCs, backfill from old config, drop old L1/L2 columns + helpers, RLS updates.
- `src/routes/masters.approvals.tsx` — replace L1/L2 dropdowns with dynamic levels editor + Add Level.
- `src/routes/daily-entry.tsx` — wire Send to Approval to `submit_sheet`; refresh status badge with `current_level`.
- `src/routes/approvals.tsx` — filter via `is_current_sheet_approver`; call new RPCs.
- `src/integrations/supabase/types.ts` regenerates after migration.
- Memory update: `mem://features/approval-workflow` to reflect N-level sequential model.
