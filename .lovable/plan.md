## Plan

1. **Fix the stale bottom total while editing**
   - Update the Daily Entry input handling so numeric changes always create a complete row object before recalculating totals.
   - Ensure footer totals (`TOTAL`, column totals, security, deficiency) are derived from the latest in-memory row values immediately after edits.

2. **Fix saved sheet total after save**
   - After saving an edited sheet, reload the saved entries list so **Total Headcount** reflects the newly saved database values.
   - Make sure the editor stays consistent with the reloaded sheet data.

3. **Preserve edit-lock rules**
   - Keep editing enabled only for draft/rejected sheets.
   - Keep editing disabled after “Send to Approval”.

## Likely cause

The displayed footer total is calculated from local `rows` state. The current edit handlers only patch the changed key onto the existing row; if a row is missing or stale during reload/edit transitions, the derived footer can continue showing old values until a full reload. I’ll make the row update path safer and ensure post-save reload refreshes both the sheet and saved list totals.