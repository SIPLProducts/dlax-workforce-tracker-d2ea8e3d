## Past dates must always open read-only in Daily Entry

**Bug:** in `src/routes/daily-entry.tsx → loadEntries()` (~lines 376–390), the mode-selection block treats a past date with no entries as `edit`. So picking yesterday on a blank sheet opens with editable inputs instead of disabled ones.

**Fix:** make `isPastDate` always force `view`, regardless of row count. The Edit button is the only way to unlock fields on a past date.

```text
if (pendingModeRef.current)  -> honor explicit Edit/View click
else if (isPastDate)         -> "view"   (ALWAYS, even when blank)
else if (nRows === 0)        -> "edit"   (today, blank — unchanged)
else                         -> "view"
```

No other code changes needed:
- Inputs already render `disabled={readOnly}` where `readOnly = mode === 'view' || !canEdit`, so flipping mode to `view` is enough to disable every cell, remarks, and weather field.
- The "Send to Approval locks editing" rule already works: once the sheet status becomes `pending` or `approved`, `canEdit` is `false`, so `readOnly` is forced true and the Edit button shows the lock tooltip ("Awaiting approval at Level X" / "Approved — cannot modify"). No change required there.

## Out of scope

- No DB / RLS / approval-flow changes.
- No change to Save or Send to Approval handlers.
- Landing-page (Dashboard vs Daily Entry) issue — handled separately.

## Verification

1. Pick yesterday's date with existing draft entries → all fields disabled, Edit button enabled → click Edit → fields editable → Save → returns to view.
2. Pick yesterday's date with NO entries → all fields disabled (previously editable) → must click Edit to enter data.
3. Pick today's date with no entries → opens editable (unchanged).
4. Click Send to Approval on a draft → status becomes pending, Edit button shows lock tooltip, all fields disabled.
