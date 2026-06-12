Plan to fix the OT Entry Sheet issue without affecting Daily Entry or saved OT records:

1. Update the OT route entry behavior
   - Remove the current hard gate that shows “No OT session active” whenever `/ot-entry` is opened without `from=daily`.
   - Make `/ot-entry` always render the OT Entry Sheet editor.
   - The editor will still open blank by default, using the existing `openedSheetRef` behavior.

2. Keep saved-record loading separate and explicit
   - Preserve the current logic that only loads OT data when:
     - a saved OT sheet is opened from the Saved Entries tab,
     - an approval/view link passes a specific project and date,
     - or the sheet has just been saved.
   - Keep `sheet_type = "ot"` filters intact so Daily Entry data never appears in OT Entry.

3. Adjust the blank initial state
   - Direct sidebar navigation to OT Entry should show the normal OT Entry Sheet UI with empty rows, not the inactive-session card.
   - It should not auto-load existing OT records for the default project/date.

4. Verify navigation paths
   - Sidebar → OT Entry: blank OT sheet UI.
   - Daily Entry OT prompt → OT Entry: blank OT sheet for entry.
   - Saved Entries → View/Edit: opens OT Entry and loads the selected OT data.
   - Approvals → View OT record: opens OT Entry and loads the selected OT data.

Technical details:
- Changes are limited to `src/routes/ot-entry.tsx`.
- No database, RLS, schema, Daily Entry save, or approval workflow changes.