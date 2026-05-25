## Plan

### 1. Past-date entries open in disabled (view) mode
In `src/routes/daily-entry.tsx` `loadEntries()`, the mode is currently auto-set to `"edit"` whenever the loaded sheet has zero rows. This makes a previous date with no entries instantly editable.

Change the default-mode logic so that:
- If `pendingModeRef.current` is set (user clicked Edit / Send-to-Approval), honor it as today.
- Else if the selected date is **before today**, always default to `"view"` (disabled), even when there are no rows. The user must click **Edit** to unlock editing (and Edit is only enabled when the sheet status allows it: empty / draft / rejected).
- Else (today or future) keep current behavior: empty → edit, otherwise → view.

Keep the existing rule that once status is `pending` or `approved`, `canEdit` is false and clicking Edit has no effect — so "after Send to Approval the entry is no longer editable" continues to work unchanged.

### 2. Honor first accessible screen as landing page
Today, `/` always renders the Dashboard regardless of permission. A user whose first accessible screen is Daily Entry still lands on the Dashboard.

Fix in `src/routes/index.tsx`:
- Use `usePermissions()` inside the index component.
- While permissions are loading, show a spinner.
- After load: if the user has `view` on `dashboard`, render the Dashboard as today.
- If the user does **not** have `view` on `dashboard`, redirect via `<Navigate>` to the first screen from `APP_SCREENS` (in `src/lib/screens.ts`) for which `canView(screen)` is true (e.g. `daily_entry`, then `approvals`, `reports`, masters, etc.). Fall back to `/login` if nothing is accessible.

This uses the existing screen ordering in `APP_SCREENS` as the natural "first screen" priority and requires no schema change.

### Technical notes
- File touched: `src/routes/daily-entry.tsx` (mode-selection branch inside `loadEntries`).
- File touched: `src/routes/index.tsx` (wrap `DashboardContent` with a permission-aware gate using `usePermissions` + `Navigate` + `APP_SCREENS`).
- No DB / RLS / auth changes.
- No change to `ScreenGuard` (still guards direct URL access to `/daily-entry`, `/approvals`, etc.).
