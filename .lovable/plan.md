## Objective
Temporarily disable the forgot-password flow on `/login` by commenting out all related UI and state logic, without affecting any other functionality.

## Scope
- `src/routes/login.tsx`

## Changes
1. Comment out the `forgotOpen`, `fpUserId`, `fpNew`, `fpConfirm`, `fpShowNew`, `fpShowConfirm`, `fpLoading` state declarations.
2. Comment out `resetFn = useServerFn(resetPasswordByUserId)`.
3. Comment out `handleForgotSubmit`.
4. Comment out the "Forgot password?" link button in the login form.
5. Comment out the entire `<Dialog>...</Dialog>` block for the forgot-password modal.
6. Keep all imports at the top of the file intact (even if some become unused temporarily) so re-enabling later is a simple uncomment.
7. Leave the login form, brand panel, QR code, background mesh, and sign-in handler completely untouched.