## Plan

1. **Make Edit open reliably before submission**
   - Update the Daily Entry sheet loading flow so selecting **Edit** for a saved draft/rejected sheet keeps the page in edit mode after the project/date data reload finishes.
   - Keep the existing rule: sheets in `draft` or `rejected` can be edited; sheets in `pending` or `approved` cannot.

2. **Disable editing immediately after Send to Approval**
   - After **Send to Approval**, force the page back to view/read-only mode and reload the sheet status.
   - The Edit button will remain visible but disabled with the existing approval-lock reason while status is pending.

3. **Show submitter name in the sheet view**
   - Load `submitted_by` from `daily_manpower_sheets` on Daily Entry.
   - Fetch the submitter profile name/login ID and display it below the status area as **Submitted By: <name>**.
   - If the sheet has not been submitted yet, show a dash or no submitted name.

4. **Apply the same submitter data to saved sheets if needed**
   - Include `submitted_by` in the Saved Entries query so the list data stays consistent with the main sheet details.

## Technical details

- Primary file: `src/routes/daily-entry.tsx`.
- No database schema change is required for this request because `submitted_by` already exists on the sheet records and the approval RPC already sets it on submission.
- The fix will likely use a small “pending load mode” ref/state so `loadEntries()` does not overwrite an explicit Edit click back to View.