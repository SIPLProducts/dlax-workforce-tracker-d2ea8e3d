## What's wrong (verified in the database)

Entry rows carry their own `status` column, and it has drifted out of sync with the sheet's real approval state. Checked live data:

- Sheet DE-000076 (Testing, 29-07-2026) is **Draft**, but its single entry row is stored as **approved** — that's why it appears under the Approved filter in both Reports and Dashboard.
- Same drift on DE-000070 and DE-000071 (draft sheets, approved rows).

Cause: the insert trigger `set_daily_manpower_initial_status` stamps a row as `approved` whenever the project has no enabled approval configuration, regardless of what the sheet it belongs to says. The sheet (`daily_manpower_sheets.status`, driven by submit/approve/reject) is the real source of truth; the row copy is only refreshed on submit/approve/reject, so rows created outside those paths stay wrong.

## Fix

1. **Migration — make the row status derive from the sheet**
   - Rewrite `set_daily_manpower_initial_status` so a new row inherits the status of the sheet it is attached to (draft / pending / approved / rejected), instead of reading `approval_enabled`. It must run after `assign_daily_sheet` so the sheet exists.
   - Add a trigger on `daily_manpower_sheets` that propagates any sheet status change to all its rows, so the two can never drift again.
   - One-time backfill: set every `daily_manpower.status` from its sheet's current status (`draft`→draft, `pending`→pending_l1, `approved`→approved, `rejected`→rejected). This alone corrects DE-000076/70/71 immediately.

2. **Frontend — no hardcoded status assumptions**
   - No query logic changes are required in `src/routes/index.tsx` or `src/routes/reports.tsx`; they already filter on the live `status` column (Approved = `approved`, Pending = `pending_l1`/`pending_l2`), which becomes correct once the data is sheet-driven.
   - Only cleanup: keep the Pending filter matching the generic pending markers used by the backend so partially-approved multi-level sheets still count as Pending.

## Technical notes

- No changes to approval workflow functions (`submit_sheet`, `approve_sheet`, `reject_sheet`) — they keep writing sheet status, and the new propagation trigger keeps rows aligned.
- Nothing else on the Dashboard, Reports, Daily Entry, or OT Entry screens changes.

## Verification

- Re-run the row-vs-sheet status comparison query; every row must match its sheet.
- With Status = Approved on 29-07-2026, the draft "Testing" sheet must disappear from both the Daily Labour Report and the Dashboard totals.
