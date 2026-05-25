## Fix

Apply the same View-mode guard to the Daily Entry screen (`src/routes/daily-entry.tsx`):

1. Import `usePermissions` and read `canEdit("daily_entry")` (call it `canEditScreen` to avoid clashing with the existing local `canEdit` flag, which is status-based — draft/rejected vs locked).
2. Add a `requireEdit()` helper that returns false and toasts **"You are in View mode, not in Edit mode."** when `!canEditScreen`.
3. Call `requireEdit()` at the top of:
   - `handleSave` (Save / Save as Draft)
   - The switch-to-edit handlers: `setMode("edit")` button (line 442), the "+" / new-entry button (line 607), and the row Edit pencil → `loadSheetIntoEditor(s, "edit")` (line 641)
4. Submit-for-approval handler (if it exists below line 367) — same guard.

No DB / RLS changes. RLS stays as the backstop; this just replaces the cryptic RLS error with the friendly toast.
