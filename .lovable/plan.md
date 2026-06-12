## Problem

When the user enters the OT Entry Sheet (via Daily Entry → OT prompt or direct navigation), the grid currently auto-populates any previously saved OT rows for the same project + date. The user wants it to open blank and only show records when a specific saved OT sheet is explicitly opened via View/Edit from the Saved Entries tab (or via View from Approvals with an explicit date).

## Fix — `src/routes/ot-entry.tsx` only

No DB / RLS / schema changes. Daily Entry untouched.

1. **Add an `openedSheetRef` flag** (default `false`) indicating whether the current editor state represents an explicitly opened saved sheet vs. a fresh blank session.

2. **Set the flag to `true`** in these paths:
   - Deep-link effect when `search.date` is present (View from Approvals, or Daily Entry passing the previous-day date).
   - `loadSheetIntoEditor` (View/Edit from the Saved Entries tab).
   - After a successful `handleSave` (so the just-saved sheet stays loaded and re-edits keep working).

3. **Gate `loadEntries`** so that when `openedSheetRef.current === false`:
   - Skip the `daily_manpower` and `daily_manpower_sheets` reads.
   - Seed `rows` from `contractors` with `emptyRow()`, clear `orphanCells`, and clear the sheet header (no Sheet ID, status `Draft / Editing`, no submitted-by).
   - Approval config / levels can still load (needed to render the Send to Approval button correctly).

4. **Reset the flag to `false`** when the user changes project or date manually (so switching project/date returns to a blank sheet) and when the route unmounts. Changing project/date via `loadSheetIntoEditor` re-sets it to `true` after the state update.

5. **Saved Entries tab unchanged** — it still lists OT sheets for the current project; clicking View/Edit calls `loadSheetIntoEditor` which now also flips the flag and triggers `loadEntries` to populate the grid from the saved sheet.

## Verification

- Open OT Entry Sheet from Daily Entry (with `from=daily`, no `date` in URL) → grid renders empty rows for all assigned contractors; no pre-existing OT headcounts appear; Sheet ID area shows Draft / Editing with no code.
- Save an OT entry → grid keeps showing what was just saved (flag flipped on save).
- Navigate away and back (fresh `from=daily`, no date) → grid is blank again even though a saved OT sheet exists for that project+date.
- Saved Entries tab → click View on an OT sheet → grid populates with that sheet's data (unchanged behavior).
- View from Approvals (URL has explicit `date`) → grid populates with that sheet's data (unchanged behavior).
- Daily Entry Sheet behavior unchanged.
