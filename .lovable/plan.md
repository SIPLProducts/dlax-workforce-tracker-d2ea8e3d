## Add "Change Password" to user menu

In the TopBar user dropdown (top-right), add a **Change Password** item above Sign Out. Clicking it opens a modal with:
- Old password
- New password
- Confirm new password
- Cancel / Change button

### Behavior
1. Verify old password by re-authenticating: `supabase.auth.signInWithPassword({ email: user.email, password: oldPassword })`. If it fails → toast "Current password is incorrect".
2. Validate new password (min 6 chars, max 72, matches confirm).
3. Update via `supabase.auth.updateUser({ password: newPassword })`.
4. On success → toast "Password updated", close modal, clear fields. Session stays signed in.

### Files
- `src/components/TopBar.tsx` — add `<DropdownMenuItem>` "Change Password" that opens a new `<ChangePasswordDialog />`; add state to control open.
- `src/components/ChangePasswordDialog.tsx` (new) — shadcn `Dialog` with three password inputs, show/hide toggle, loading state, validation, and the two-step verify + update flow above.

Purely frontend — no schema, server function, or migration needed (uses existing browser Supabase client).
