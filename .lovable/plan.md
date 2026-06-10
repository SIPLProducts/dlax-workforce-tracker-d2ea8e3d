## Goals

1. Allow editing the **User ID** (login_id) in the Edit User dialog.
2. Address the "existing password not fetched" issue.
3. Remove **all System Roles** buttons, columns, tabs and dialogs from the User Management screen.

---

## 1. Editable User ID

Add a "User ID" field to the Edit User dialog, pre-filled with the user's current `login_id`. Validate same as create: 2–40 chars, lowercase letters/numbers/`._-`. On save:
- Lowercase + trim the value.
- If unchanged, skip; if changed, update both the `profiles.login_id` and the auth user's `email` (kept in sync as `<loginId>@dlax.local`, matching the create flow) plus `user_metadata.login_id`.
- Pre-check uniqueness against `profiles.login_id` (case-insensitive), excluding the current user. Return a clear "User ID already exists" error if taken.

Extend `adminUpdateUser` server fn input to accept an optional `loginId` and perform the validation, uniqueness check, `auth.admin.updateUserById({ email, user_metadata })`, and `profiles.update({ login_id, email })`.

## 2. Password field clarification

Supabase stores only a one-way hash — the existing password **cannot be fetched or shown** in plain text by design (this is a security feature, not a bug). The Edit dialog will keep a **"New Password"** field that's blank by default with helper text:

> "Passwords cannot be retrieved for security reasons. Leave blank to keep the current password, or enter a new one to reset it (min 6 characters)."

No backend change needed beyond the existing password-update path.

## 3. Remove System Roles UI

In `src/routes/users.tsx`:
- Remove the **System Roles** tab (`TabsTrigger value="roles"` and its `TabsContent`). Tabs become just **Users** and **Custom Roles**.
- Remove the **System Roles** column from the Users table header and body (the `<Badge>` row showing `u.roles`).
- Remove the "Add system role" Dialog (`roleOpen`) and any leftover trigger.
- Remove related state and handlers: `roleOpen`, `selectedRole`, `savingRole` usage tied to system roles, `handleAddRole`, `handleRemoveRole`, the `ALL_ROLES` constant, and the `Shield` icon import if unused.
- Keep system-role *data* loading (`user_roles` query) intact — it's still used elsewhere (admin detection in Projects badge, `isAdmin` checks). Only the UI is removed.
- Update the empty-state `colSpan` from 6 → 5 to match the new column count.

The Custom Roles tab, projects assignment, edit, delete, and add-user flows are unchanged.

---

## Technical notes

**Files touched:**
- `src/utils/admin-users.functions.ts` — extend `adminUpdateUser` with optional `loginId` (validation, uniqueness, sync to auth `email`/metadata and `profiles`).
- `src/routes/users.tsx` — add User ID input + password helper text to Edit dialog; remove System Roles tab, column, dialog, state and handlers; adjust `colSpan`.

**Out of scope:** no DB migrations, no changes to create-user or delete flows, no changes to custom roles or project assignment.
