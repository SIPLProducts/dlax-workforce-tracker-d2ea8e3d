## Goal

In `src/routes/daily-entry.tsx`, after saving a draft sheet:
- **Save button does nothing** when clicked again after edits (no toast, no DB update).
- **Row total** in the green "Total" column doesn't reflect the edited values live.

Fix both, scoped to the frontend only. No DB schema, RLS, or business‑logic changes.

## Investigation summary

Reading `daily-entry.tsx`:

- `handleSave` is wired correctly; the Save button is gated by `disabled={saving || !canEdit}`. If it appears clickable but produces no toast, the most likely culprits are:
  1. `requireEdit()` returns false silently when `usePermissions().canEdit("daily_entry")` is false — it *should* show a toast, but if the permission hook returns `undefined` during first render, the click may be a no‑op. (We'll add a hard fallback + a console diagnostic.)
  2. `allCells.length === 0` early‑returns with a toast, but the toast can be missed; we'll surface the reason more visibly.
  3. After the first save, `setMode("view")` runs. If the user re‑clicks Edit and the underlying `rows` map was rebuilt by `loadEntries`, but the typed cell key (`cellKey(dept, cat)`) doesn't match what the grid renders (orphan / legacy blob path), edits stay in state but Save's `inserts` array ends up identical to the existing DB rows — feels like "nothing happened". Add a log of the inserts payload to confirm.

- `rowTotal(r)` sums `displayCells` only. If a cell value lives under an orphan key (dept/cat no longer assigned) or under a legacy key not in `displayCells`, typing into a visible cell *does* update `rows`, but the green Total just re‑sums `displayCells` — so it should update. Need to confirm whether the total is actually stale or whether the user is reading the *footer* `colTotals` (memoized) which depends correctly on `rows` and `displayCells`.

## Plan

### 1. Add diagnostics to `handleSave` (temporary, removed after confirmation)
- `console.debug("[daily-entry] save", { projectId, canEdit, canEditScreen, allCellsCount: allCells.length, inserts });` just before the delete/insert.
- Replace silent guards with explicit `toast.error(...)` messages: if `requireEdit()` short‑circuits because `canEditScreen` is undefined, fall back to allowing admins via `has_role` already implicit in RLS — but at minimum surface a toast like *"You don't have edit permission for Daily Entry."*.

### 2. Fix Save no‑op on re‑edit
- Always toast on every early‑return path in `handleSave` (project, user, canEdit, allCells). Currently each does, but verify; ensure none silently `return;`.
- After `setMode("view")` post‑save, also clear stale `pendingModeRef` and force a fresh `loadEntries()` so the next Edit cycle reads the just‑written rows (already done — verify ordering).
- If `inserts.length === 0` AND `orphanRowIdsRef.current.length === 0` AND nothing changed, show *"Nothing to save"* instead of the misleading *"Saved (no entries)"*.

### 3. Fix row‑total live update
- Memoize `rowTotal` per contractor with `useMemo` keyed on `[rows, displayCells]` so React reliably re‑renders the green column when any cell mutates. Replace the inline `{rowTotal(r) || ""}` with a lookup into the memo map.
- Also include **orphan cell values** in the row total so the displayed total matches what will be saved (orphan rows are preserved on Save). Add their values to the sum.

### 4. Re‑verify after change
- Open Daily Entry, create a draft, click Edit, change a number → green Total updates instantly.
- Click Save → toast appears, DB row reflects new value, Saved Entries list "Total" column updates after refresh.

## Files touched

- `src/routes/daily-entry.tsx` (only)

## Out of scope

- Worker attendance UI (user didn't clarify; not currently part of this screen).
- Any approval / RLS / schema work.
- Sticky‑header layout (already shipped in prior turn).
