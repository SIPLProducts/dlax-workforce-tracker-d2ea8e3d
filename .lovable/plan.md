## Switch login from Email to User ID

Currently users sign in with their email address. You want them to sign in with a **User ID** (e.g. `john.doe`, `kpc001`) instead.

### How this will work

Supabase Auth requires an email under the hood, so we use a common pattern:

1. **Each user gets a `user_id` (login handle)** stored on their profile — short, unique, case-insensitive (e.g. `kpc001`, `ravi.kumar`).
2. **Behind the scenes** we store a synthetic email like `kpc001@dlax.local` in Supabase Auth. The user never sees or types it.
3. **Login screen** shows a "User ID" field instead of "Email". When the user types their ID, we look up the matching synthetic email and sign them in.
4. **Admin "Add User" screen** asks for: User ID, Display Name, Password (no email field). Real email becomes optional (kept on profile only, for records).

### What changes

**Database (1 migration):**
- Add `login_id` column (text, unique, lowercase) to `profiles` table.
- Backfill existing users' `login_id` from the part of their email before the `@`.
- Add a small RPC `get_email_for_login_id(login_id)` so the login screen can resolve a User ID → synthetic email without exposing the profiles table publicly.

**Login screen (`src/routes/login.tsx`):**
- Replace "Email address" field with "User ID".
- On submit: call the RPC to resolve the User ID → email, then sign in.
- Remove the Sign Up toggle from the public login (only admins create users).

**User Management (`src/routes/users.tsx`):**
- "Add User" dialog: replace Email field with **User ID** field. Keep Display Name + Password.
- User table: show **User ID** column instead of (or alongside) Email.
- On create: generate `${userId}@dlax.local` as the synthetic auth email, set `login_id` on the profile, and store the chosen user ID.

**Auth helper (`src/hooks/use-auth.tsx`):**
- Add a `signInWithUserId(userId, password)` method that does the lookup + sign in.
- Existing `signIn(email, password)` stays for backward compatibility.

### What stays the same
- Roles, permissions, RLS, all other screens — unchanged.
- Existing users keep working: their `login_id` is auto-derived from their current email's local part (e.g. `admin@kpc.com` → login ID `admin`). They can keep using the same password.
- No emails are sent for login (no verification needed since the address is internal).

### Open question

For existing users whose emails collide when stripped (e.g. `admin@a.com` and `admin@b.com` both → `admin`), we'd need to disambiguate. If you confirm there are no such collisions today (or you want me to append a number for collisions), I'll proceed.

### Files touched
- `supabase/migrations/<new>.sql` — add `login_id`, backfill, RPC
- `src/routes/login.tsx` — User ID field
- `src/routes/users.tsx` — Add User by User ID
- `src/hooks/use-auth.tsx` — `signInWithUserId` helper
