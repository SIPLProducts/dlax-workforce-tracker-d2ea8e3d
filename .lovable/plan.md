## Plan

Fix the Daily Entry approval changes at the source: the UI has most of the new buttons, but the database triggers that create/link daily sheets are not currently active, so saved rows may not produce a visible sheet record to submit.

## What I will change

1. **Restore sheet creation on save**
   - Add/repair the database triggers so every `daily_manpower` insert is linked to a `daily_manpower_sheets` row.
   - Ensure approval-enabled projects save rows as `draft`, while non-approval projects remain auto-approved.
   - Backfill any existing `daily_manpower` rows that currently have no `sheet_id`, grouped by project and date.

2. **Make Daily Entry buttons visibly consistent**
   - Keep the three sheet actions visible as requested: **View**, **Edit**, and **Send to Approval**.
   - If an action is not currently allowed, show it disabled with the reason instead of hiding it.
   - In the saved sheets list, change the action label from short **Send** to **Send to Approval** for clarity.

3. **Improve Daily Entry refresh behavior**
   - After saving, reload the generated sheet immediately so the **Sheet ID**, status badge, and **Send to Approval** button appear without needing a page refresh.
   - After sending to approval, reload both the current sheet and saved sheets table so the status updates to `Pending — Level 1/N (Approver)`.

4. **Preserve sequential routing**
   - Keep routing based only on `project_approval_levels` for that project.
   - Submission will still go to Level 1 only; after approval it advances to Level 2, then Level 3, etc.
   - No unrelated roles/users will receive or see the approval unless they are configured as the current level approver.

## Files/areas involved

- Database migration: restore triggers and backfill missing sheet links.
- `src/routes/daily-entry.tsx`: make the sheet action buttons and refresh behavior match the requested workflow.

## Acceptance check

- Save a Daily Entry sheet and immediately see a **Sheet ID**.
- See **View**, **Edit**, and **Send to Approval** on the Daily Entry screen.
- Click **Send to Approval** and see the sheet move to pending Level 1.
- Only the configured Level 1 approver sees it in Approvals; after approval, only Level 2 sees it.