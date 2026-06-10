## Goal
On the User Management screen: (1) remove the "System" button from each row, (2) add an "Edit" button that opens a dialog to update the user's Display Name and/or Password, with the changes persisted server-side.

## Backend — `src/utils/admin-users.functions.ts`
Add a new server function `adminUpdateUser`:
- Input: `{ userId: string; displayName?: string; password?: string }`
- Validation: at least one of `displayName` or `password` provided; if password present, min 6 chars
- Permission check (same pattern as `adminCreateUser`/`adminDeleteUser`): allow if caller is system `admin` OR has `edit` on `user_management`
- Uses `supabaseAdmin` (service role) to:
  - If `password` provided → `auth.admin.updateUserById(userId, { password })`
  - If `displayName` provided → update `profiles.display_name` and also mirror into `auth.users.user_metadata.display_name`
- Returns `{ userId, displayName }`

## Frontend — `src/routes/users.tsx`
- Remove the "System" button (lines 484–486) from the row Actions cell. System role management is still reachable via the existing "System Roles" tab, so no functionality is lost.
- Add a new "Edit" button (Pencil icon) in the Actions cell, before "Custom".
- Add an Edit dialog with two fields:
  - Display Name (text, prefilled with current value)
  - New Password (password, optional, placeholder "Leave blank to keep current", min 6 if filled)
  - Save / Cancel buttons; Save calls `adminUpdateUser` via `useServerFn`
- On success: toast, close dialog, `fetchAll()` to refresh the row.
- On error: toast the server message.

## Out of scope
- Editing User ID (login_id) — not requested, and changing it would affect login lookups.
- Editing email / system roles — system roles still managed via the existing tab and "Custom" button.

## Verification
- As admin, click Edit on a user, change display name only → row updates, no password change needed.
- Edit and set a new password → toast success; sign in as that user with the new password.
- "System" button no longer appears in the row; "System Roles" tab still works.
