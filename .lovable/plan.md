# Forgot Password — No-Verification Reset

> ⚠️ **Security note (acknowledged):** This flow lets anyone who knows a User ID change that account's password. Approval workflows, project data, and admin access are all reachable by guessing a User ID. Proceeding as requested.

## UX

1. **Login page** — add a small **"Forgot password?"** link under the Password field (right-aligned, indigo text).
2. Click → opens a **modal dialog** on the same page (no new route, keeps it self-contained):
   - **User ID** input
   - **New Password** input (with eye toggle, min 6 chars)
   - **Confirm Password** input (with eye toggle, must match)
   - **Reset Password** button + **Cancel**
3. On submit:
   - Validate fields client-side (non-empty, match, min length).
   - Call a public server function `resetPasswordByUserId({ loginId, newPassword })`.
   - On success: toast "Password updated. Please sign in." → close modal, prefill User ID in the login form.
   - On failure: toast the error (e.g., "User ID not found").

## Technical Details

### New server function — `src/utils/auth-reset.functions.ts`

`resetPasswordByUserId` — `createServerFn({ method: "POST" })`, **no auth middleware** (public).

- `.inputValidator()` with Zod: `loginId` (1–40 chars, trimmed, lowercased), `newPassword` (min 6, max 72).
- `.handler()`:
  1. `await import("@/integrations/supabase/client.server")` to get `supabaseAdmin` (lazy import per import-graph rules).
  2. Look up the auth user id from `profiles` by `lower(login_id) = loginId`.
  3. If not found → throw `Error("Invalid User ID")`.
  4. `supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })`.
  5. Return `{ ok: true }`.

No DB migration needed — uses existing `profiles.login_id` and the admin client already configured.

### Login page — `src/routes/login.tsx`

- Add `Eye/EyeOff` is already imported.
- Add `forgotOpen` state and a "Forgot password?" link button under the password field.
- Add a `<Dialog>` (shadcn) at the bottom of the page containing the form above.
- New local state: `fpUserId`, `fpNew`, `fpConfirm`, `fpShowNew`, `fpShowConfirm`, `fpLoading`.
- Submit handler calls `useServerFn(resetPasswordByUserId)`, shows toast, then `setUserId(fpUserId)` and closes the dialog.

### Out of scope

- No email, SMS, admin queue, or current-password check.
- No DB schema changes.
- No changes to existing User Management edit/reset flows.

## Files Touched

- **New:** `src/utils/auth-reset.functions.ts`
- **Edit:** `src/routes/login.tsx` (add link + dialog + handler)
