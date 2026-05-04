## Goal

Add a configurable two-level approval workflow for **Daily Manpower Entries**:
- **Level 1**: Project Coordinator (PC)
- **Level 2**: Project Manager (PM)
- Either level can **Reject with remarks** → entry returns to Supervisor for edit & resubmit
- Approval flow can be **enabled/disabled per project**, and PC/PM users picked per project

## New Roles

Extend `app_role` enum with two new system roles:
- `project_coordinator`
- `project_manager`

These are assignable in the existing **User Management** screen alongside Admin/Supervisor/Manager.

## Database Changes

1. **`daily_manpower`** — add workflow columns:
   - `status` (`draft` | `pending_l1` | `pending_l2` | `approved` | `rejected`) default `pending_l1`
   - `submitted_by`, `submitted_at`
   - `l1_approver_id`, `l1_action_at`, `l1_remarks`
   - `l2_approver_id`, `l2_action_at`, `l2_remarks`
   - `rejection_remarks`, `rejected_by_level`

2. **`project_approval_config`** (new table) — per-project setup:
   - `project_id` (unique)
   - `approval_enabled` (bool)
   - `l1_user_id` (PC for this project)
   - `l2_user_id` (PM for this project)

3. **RLS policies**:
   - Supervisors: insert/update only their own entries while `status` is `draft` or `rejected`
   - PC: update entries where they are the project's L1 and `status = pending_l1`
   - PM: update entries where they are the project's L2 and `status = pending_l2`
   - Admins: full access

4. On insert: trigger sets `status` to `pending_l1` if project has approval enabled, otherwise `approved`.

## New Screen: **Approvals**

Sidebar entry under "Workflow" → `/approvals`. Visible to PC, PM, Admin.

Layout:
- **Tabs**: `Pending My Approval` · `My Submissions` · `All History`
- **Filters**: Project, Date range, Status
- Table columns: Date · Project · Contractor · Department · Headcount · Submitted by · Status badge · Actions
- Row actions:
  - **View details** (drawer with full entry breakdown)
  - **Approve** (advances L1→L2, or L2→approved)
  - **Reject** (modal requires remarks; sends back to supervisor as `rejected`)
- Status badges color-coded: pending_l1 (amber), pending_l2 (blue), approved (green), rejected (red)

## New Screen: **Project Approval Settings**

Admin-only, accessible from Masters → Projects (new "Approval" button per row) and as a standalone page `/masters/approvals`.

Per project row:
- Toggle: **Enable Approval Workflow**
- Dropdown: **Level 1 — Project Coordinator** (lists users with `project_coordinator` role)
- Dropdown: **Level 2 — Project Manager** (lists users with `project_manager` role)
- Save button

## Daily Entry Screen Changes

- After save, entries respect workflow: if project has approval enabled → entry goes to `pending_l1`
- Show status badge on each row in the supervisor's daily entry list
- **Rejected** rows show rejection remarks and an **Edit & Resubmit** button (resets to `pending_l1`)

## Sidebar / Permissions

- Add `approvals` and `masters_approval_config` to `src/lib/screens.ts`
- Update `use-permissions.tsx` baseline:
  - `project_coordinator`: `approvals: edit`, `dashboard: view`, `reports: view`
  - `project_manager`: `approvals: edit`, `dashboard: view`, `reports: view`
- Add nav item "Approvals" in `AppSidebar.tsx`

## Out of Scope (this iteration)

- Email/push notifications on submission/approval (can be added later)
- Bulk approve
- Approval workflow for Worker Attendance (only Daily Manpower per your answer)

Ready to implement on approval.