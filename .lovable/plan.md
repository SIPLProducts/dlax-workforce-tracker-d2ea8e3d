## Root cause

The error is from Row Level Security on the role-management tables:

- `custom_roles` currently allows role creation/edit/delete only for system admins.
- `role_screen_permissions` currently allows screen-permission insert/delete/update only for system admins.
- `user_custom_roles` currently allows assigning custom roles only for system admins.

So a user who has **User Management - edit** can open the screen, but database writes still fail with: `new row violates row-level security policy for table "custom_roles"`.

## Plan

1. **Update database access rules for custom roles**
   - Allow users with `user_management` edit permission to create, edit, and delete `custom_roles`.
   - Keep system admins fully allowed.
   - Keep authenticated users able to view role definitions.

2. **Update database access rules for screen permissions**
   - Allow users with `user_management` edit permission to create, update, and delete rows in `role_screen_permissions`.
   - This fixes saving the selected screen permissions after a role is created.

3. **Update database access rules for role assignment**
   - Allow users with `user_management` edit permission to assign and remove `user_custom_roles`.
   - Keep existing protection that users can view only their own custom-role assignment unless they have management access.

4. **Preserve security boundary**
   - Do not make these tables public.
   - Do not allow anonymous access.
   - Do not grant unrelated screens this ability; only `user_management` edit permission can manage users/roles.

5. **Optional UI cleanup after the migration**
   - If needed, adjust the error message in the role dialog to show a clearer message like “You need User Management edit permission to save roles” instead of the raw database error.