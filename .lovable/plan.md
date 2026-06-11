# OT Entry Sheet

Add a new "OT Entry Sheet" screen that mirrors Daily Entry's layout, workflow, and approval, but is locked to the previous day's date and adds a per-row OT hours column. After saving on Daily Entry, prompt the user to optionally jump to the OT sheet for the same project/yesterday.

## Database (one migration)

Reuse existing tables by adding a sheet type discriminator.

1. `daily_manpower_sheets` — add `sheet_type text NOT NULL DEFAULT 'daily' CHECK (sheet_type IN ('daily','ot'))`.
2. `daily_manpower` — add `sheet_type text NOT NULL DEFAULT 'daily'` and `ot_hours numeric(5,2)` (the new Time column).
3. `worker_attendance` — add `sheet_type text NOT NULL DEFAULT 'daily'` so individual worker rows can also be tagged.
4. Drop and recreate the uniqueness on `daily_manpower_sheets(project_id, entry_date)` to include `sheet_type`, so a project can have one Daily and one OT sheet per date.
5. Update `assign_daily_sheet()` trigger to look up / create the sheet matching `NEW.sheet_type` as well as project + date.
6. Update `submit_sheet`, `approve_sheet`, `reject_sheet`, and `set_daily_manpower_initial_status` — no logic change beyond preserving `sheet_type` (they already operate by `sheet_id`, so behaviour is shared automatically). The same `project_approval_config` and `project_approval_levels` govern OT sheets.
7. Backfill: existing rows get `sheet_type = 'daily'` via the defaults. No data move.

## New screen + routing

1. New route file `src/routes/ot-entry.tsx` (`/ot-entry`). Cloned from `daily-entry.tsx` and adjusted:
   - Title "OT Entry Sheet".
   - Date initialized to `yesterday = today - 1 day`, rendered in a disabled input; no calendar trigger, no manual edit.
   - All reads/writes against `daily_manpower_sheets` and `daily_manpower` pass `sheet_type: 'ot'` (filter on load, set on insert/upsert, propagate to upserts of `worker_attendance`).
   - Table gets a new **Time (OT Hrs)** numeric column rendered immediately before the **Remarks** column. Value bound to `daily_manpower.ot_hours` for that contractor row.
   - All other UI, validation, draft/save/submit, approval levels, status pills, view/edit toggle, worker attendance modal, and project picker behave identically to Daily Entry.
2. Add `ot_entry` to `APP_SCREENS` in `src/lib/screens.ts` so it shows in the sidebar and can be permission-controlled.
3. Add the sidebar/nav entry alongside Daily Entry in `src/components/AppSidebar.tsx` (and mobile tab bar if applicable) with `ScreenGuard screen="ot_entry"`.
4. Route registration via the auto-generated route tree — no manual edit to `routeTree.gen.ts`.

## Save → OT prompt on Daily Entry

In `src/routes/daily-entry.tsx`, after a successful Save:
- Open a `<Dialog>` titled "Enter OT?" with body "Do you want to enter OT?" and Yes / No actions.
- **Yes** → `navigate({ to: '/ot-entry', search: { project: projectId } })`. The OT page will force date = yesterday on its own.
- **No** → close the dialog; current behaviour unchanged.
- Trigger only on Save (draft save), not on Submit-for-approval.

## Approvals & reports

- `src/routes/approvals.tsx` already operates on `daily_manpower_sheets`; surface `sheet_type` as a small badge ("Daily" / "OT") on each sheet card so approvers know which one they're acting on. No workflow change.
- `src/routes/reports.tsx` — add an OT-hours column where headcount/hours are aggregated, summing `daily_manpower.ot_hours`. Filters and Excel export include the new column. (If user prefers OT excluded from reports for now, this can be removed — flagging here.)

## Permissions

`get_screen_permission` already keys off `screen_key`, so the new `ot_entry` key works automatically once roles are granted. Admins implicitly have access; other roles get permissions configured in the Roles dialog as usual.

## Files touched

- `supabase/migrations/<new>.sql` — schema + trigger update.
- `src/lib/screens.ts` — add `ot_entry`.
- `src/components/AppSidebar.tsx` (and `MobileTabBar.tsx` if it lists Daily Entry) — new nav item.
- `src/routes/ot-entry.tsx` — new route.
- `src/routes/daily-entry.tsx` — post-save prompt dialog + navigate.
- `src/routes/approvals.tsx` — show sheet_type badge.
- `src/routes/reports.tsx` — include `ot_hours` in aggregates and export.

## Open item

Reports currently summarize Daily Entry headcount. Confirm whether OT hours should appear as an extra column in the same report, or remain visible only on the OT Entry screen for now.
