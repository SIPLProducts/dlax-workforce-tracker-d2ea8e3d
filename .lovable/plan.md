## Goal
Add a Show/Hide Password (eye) toggle icon in the New Password field of the Edit User dialog on the User Management screen.

## Changes
1. In `src/routes/users.tsx`:
   - Add `showPassword` boolean state within the UsersPage component.
   - In the Edit dialog's New Password input, wrap the `<Input>` in a `relative` container.
   - Add an eye icon button (`Eye` / `EyeOff` from `lucide-react`) to the right of the input that toggles `showPassword`.
   - Bind the input's `type` to `showPassword ? "text" : "password"`.
   - Ensure the eye button uses `type="button"` to avoid form submission.

## Out of Scope
- No changes to the Create User form or any other password fields.
- No backend or validation changes.

## Implementation
Straightforward UI-only change: add local state and an absolute-positioned toggle button next to the existing password input in the Edit dialog.