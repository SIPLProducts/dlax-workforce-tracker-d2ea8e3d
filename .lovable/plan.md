## Plan

1. **Make edit mode explicit at save time**
   - In `RolePermissionsDialog`, stop relying on dialog prop timing alone.
   - If the dialog was opened for an existing role, require a valid role id before saving.
   - If the role id is missing or the role can’t be loaded, show an error instead of inserting a new role.

2. **Update permissions safely**
   - Keep the existing role row update path for edits.
   - Replace that role’s `role_screen_permissions` only after the role update succeeds.
   - For new roles, keep the insert path unchanged.

3. **Harden the parent open handlers**
   - Add explicit `openCreateRoleDialog()` and `openEditRoleDialog(roleId)` handlers in `users.tsx`.
   - Ensure the edit role id is set before the dialog opens, and cleared only after the dialog closes.

4. **Verify the behavior**
   - Check the final code path so clicking **Edit** cannot call `.insert()` unless it was opened as **New Role**.
   - Confirm duplicate-name checks still exclude the currently edited role.