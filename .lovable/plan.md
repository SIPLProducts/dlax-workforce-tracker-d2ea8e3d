# Fix: New users can't log in ("Invalid User ID or password")

## Root cause

When an admin creates a new user from **User Management**, the app calls the standard signup flow. Lovable Cloud then marks that account as **"email not confirmed"** and refuses every login attempt — even though the password is correct.

Because DLAX uses internal User IDs (not real email addresses), the confirmation email goes to a fake address like `bhelstpp@dlax.local` and is never received. Result: the account is created but permanently unable to sign in.

This is exactly what's happening with **BHELSTPP** — the auth logs show `error_code: email_not_confirmed` on every login attempt.

## The fix

Move user creation to a **secure backend function** that creates the account already confirmed, so the new user can log in the moment the admin clicks "Create User".

### What changes

**1. New backend function: `admin-create-user`**
- Only callable by admins (verified server-side using the caller's session).
- Accepts: `login_id`, `display_name`, `password`.
- Creates the auth user with `email_confirm: true` (no confirmation needed).
- Stores the User ID and display name on the profile.
- Returns success/failure to the UI.

**2. User Management screen (`src/routes/users.tsx`)**
- The inline "Create User" form now calls the new backend function instead of the public signup endpoint.
- Same UX — admin types User ID, name, password, hits Create. New user can log in straight away.
- Existing fields, layout, and "keep panel open for bulk entry" behaviour are unchanged.

**3. One-time fix for the BHELSTPP user already stuck**
- The migration will mark any existing `*@dlax.local` users as confirmed, so **BHELSTPP** (and any other already-created users in this state) can log in with their existing passwords immediately — no need to recreate them.

### What stays the same
- Login screen, User ID format, password rules, role assignment, project assignment — no changes.
- Admin user, supervisors, and managers all keep their current access.
- The public signup endpoint is no longer used for in-app user creation (admins are the only ones who create users anyway).

### Files touched
- `supabase/functions/admin-create-user/index.ts` *(new — secure admin-only user creation)*
- `supabase/migrations/<new>.sql` *(one-time: confirm existing `*@dlax.local` users)*
- `src/routes/users.tsx` *(call the new function instead of `signUp`)*

### After this is deployed
- **BHELSTPP / BHELSTPP@123** will work immediately — no need to recreate the user.
- Any new user you add from User Management will be able to log in right away.
