## Plan

1. Update the custom-role dialog so it locks the edit target when opened.
   - Add local `currentRoleId` state in `RolePermissionsDialog`.
   - When the dialog opens, copy `roleId` into `currentRoleId` and load that role’s existing data/permissions.
   - Use `currentRoleId` for update vs create, duplicate-name exclusion, permission replacement, title text, and success message.

2. Prevent accidental duplicate saves.
   - Add an early return in `handleSave` if `saving` is already true.

3. Reset edit mode when the dialog closes.
   - In `src/routes/users.tsx`, wrap `onOpenChange` so closing the role dialog also clears `editingRoleId`.
   - Keep “New Role” explicitly setting `editingRoleId(null)`.

## Expected result

Editing an existing custom role updates that same role row and replaces its permissions, instead of inserting a new custom role.