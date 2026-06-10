## Plan: Delete user from User Management

### Scope
Add a per-row Delete button on the Users tab (`/users`) that permanently removes a user (auth account + profile + role/project assignments) after a confirmation dialog.

### Backend — new server function
Add `adminDeleteUser` in `src/utils/admin-users.functions.ts`:
- Uses `requireSupabaseAuth` middleware.
- Input: `{ userId: string }`.
- Permission check (same pattern as `adminCreateUser`): allow if caller is system `admin` OR has `edit` on `user_management` (via `has_role` / `has_screen_edit` RPCs).
- Safety guards:
  - Reject if `userId === context.userId` (can't delete self).
  - Reject if target user has the `admin` system role AND is the last remaining admin (count from `user_roles` where role='admin').
- Uses `supabaseAdmin` (service role) to call `auth.admin.deleteUser(userId)`. The existing `ON DELETE CASCADE` on `auth.users` cleans up `profiles`, `user_roles`, `user_custom_roles`, `user_projects`.

### Frontend — `src/routes/users.tsx`
1. Import `adminDeleteUser` + `useServerFn`; add an `AlertDialog` (already in the codebase) for confirmation.
2. Add a red outline "Delete" button (Trash2 icon) in the Actions cell of the Users table, after the Projects button.
3. Disable the Delete button for the currently signed-in user's own row.
4. On click → open AlertDialog showing the user's `login_id` / `display_name` and a warning that the action is permanent.
5. On confirm → call `adminDeleteUser({ data: { userId } })`, show toast, refresh the users list (re-run the existing `loadData()`), close dialog.
6. Handle and toast server errors (last-admin, forbidden, etc.).

### Verification
- Sign in as admin, delete a non-admin test user → row disappears, no orphan rows in `profiles` / `user_roles` / `user_projects`.
- Try to delete own account → button disabled.
- Try to delete the only admin → server returns error, toast shown, user not deleted.
- Cancel in the confirmation dialog → nothing happens.

### Out of scope
- Bulk multi-select delete (current request is per-user with confirmation).
- Soft-delete / archive (this is a permanent delete as requested).
