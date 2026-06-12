## Problem

In **OT Entry Sheet**, after saving, the saved data does not reliably appear back in the grid because the date input is hard-locked to yesterday and the "Saved Entries → View/Edit" action deliberately ignores the saved sheet's actual date. Any OT sheet that isn't literally yesterday's becomes invisible in the entry grid. The Daily Entry sheet does not have this restriction — it loads whatever (project, date) the user opens.

## Fix

Bring OT Entry Sheet in line with Daily Entry's loading behaviour, while keeping its default-to-yesterday convenience for fresh entries.

### Changes in `src/routes/ot-entry.tsx`

1. **Unlock the date field** in the sticky filter card so the user can pick any date and the grid reloads for that (project, date) — same control style as Daily Entry (`Input` + calendar popover, with the same dd/MM/yyyy parsing already present).
2. **Saved Entries → View/Edit** (`loadSheetIntoEditor`): also set `date` and `dateText` from `s.entry_date` (currently it explicitly skips this). This lets the grid populate with the chosen sheet's saved rows.
3. **Saved Entries → Send to Approval** (`sendFromList`): keep the existing same-day reload guard — it already compares `s.entry_date` with the current `date`, which will now work correctly once the date can change.
4. **`handleSave` reload**: no behavioural change needed — `loadEntries()` already runs with the just-saved (project, date) and will now show the data because the date won't be silently overridden anywhere.
5. **Default behaviour preserved**: opening OT Entry Sheet fresh still defaults to yesterday; "New Entry" button still resets to yesterday.

No DB, RLS, schema or server-function changes. Daily Entry Sheet is untouched.

## Verification

- Save a new OT sheet for yesterday → rows remain visible in the grid in view mode.
- From **Saved Entries**, click View on an older OT sheet → date switches to that sheet's date and the grid shows its saved headcounts, OT hours, remarks and weather.
- Click Edit on a draft/rejected OT sheet from Saved Entries → grid loads in edit mode for the correct date.
- Change the date manually to a date with no OT data → grid shows empty editable state (as today).
