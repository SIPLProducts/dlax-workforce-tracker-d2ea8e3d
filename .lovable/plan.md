## Goal

Make the Daily Entry screen workflow-aware: save a draft sheet per project+date, list it below with a unique ID, and provide View / Edit / Send to Approval actions. Approved sheets are read-only; rejected sheets become editable again.

## Database changes

1. New `daily_manpower_sheets` table (one row per project + entry_date):
   - `sheet_code` text — auto sequence `DE-000001` (generated from a Postgres sequence)
   - `project_id`, `entry_date`, `status` (draft / pending_l1 / pending_l2 / approved / rejected)
   - submitted_by/at, l1/l2 approver+remarks+action_at, rejection_remarks
   - unique (`project_id`, `entry_date`)
2. Add `sheet_id` FK column to existing `daily_manpower` rows so each contractor row belongs to a sheet.
3. Trigger: on insert, assign `sheet_code` from a sequence; default `status='draft'`.
4. Update existing approval trigger to operate at the sheet level instead of per row. Per-row `status` is removed from UI logic (kept only for backward compatibility; UI reads sheet status).
5. RLS:
   - Sheet: view if `has_project_access`; insert/update if user has `daily_entry` edit + project access AND sheet is in `draft`/`rejected`; L1/L2 can update status transitions; admin full.
   - Tighten `daily_manpower` UPDATE policy to also require parent sheet status ∈ (draft, rejected) for non-approvers.

## Daily Entry UI changes (`src/routes/daily-entry.tsx`)

1. **Mode state** on page: `mode = 'view' | 'edit' | 'new'`. When a sheet exists for selected project+date, default to `view` (inputs disabled). When none exists, default to `new`.
2. **Save button** now upserts a `draft` sheet + replaces its `daily_manpower` rows. Toast shows the assigned `sheet_code`.
3. **Send to Approval button** (next to Save, visible only when sheet exists and status ∈ draft/rejected): confirms, sets sheet status to `pending_l1`, locks the sheet.
4. **Action bar** above the table reflects current sheet:
   - Shows `Sheet ID: DE-000123 · Status: <badge>` when a sheet exists.
   - Buttons: **View** (read-only), **Edit** (enabled only if status ∈ draft/rejected), **Send to Approval**, **Save**.
   - Edit disabled with tooltip "Approved — cannot modify" when status = approved; disabled when pending_l1/l2 with tooltip "Awaiting approval".
5. **Saved Entries table** below the sheet:
   - Columns: Sheet ID, Date, Project, Total Headcount, Status badge, Submitted by, Actions (View / Edit / Send to Approval).
   - Lists sheets the user has project access to, newest first, with date+project filters.
   - Clicking View/Edit loads that sheet into the editor above and scrolls up; sets mode accordingly.

## Behavior rules

- **View**: all inputs disabled, Save/Send hidden.
- **Edit**: inputs enabled, Save visible. Allowed when status is draft or rejected. Saving keeps status as draft (or moves rejected → draft) until Send to Approval is pressed.
- **Send to Approval**: project+date sheet → status `pending_l1`. Edit disabled afterwards until rejected.
- **Approved**: row locked permanently in Daily Entry; only Admin can override (via existing admin RLS).
- **Rejected**: Edit re-enabled; Save keeps draft; Send to Approval re-submits to L1.

## Files touched

- New migration: sheets table, sequence, trigger, RLS, FK on `daily_manpower`.
- `src/routes/daily-entry.tsx`: mode state, sheet header bar, action buttons, saved-entries list, load-on-click.
- `src/routes/approvals.tsx`: switch to acting on `sheet_id` (group rows by sheet) — minimal change so existing approvers still work.
- Memory update: `mem://features/daily-manpower-tracking` to mention sheet model + sheet_code.

## Out of scope

- Bulk approval UI redesign (kept as-is; just operates on sheet status now).
- Editing individual contractor rows after approval (Admin-only path unchanged).
