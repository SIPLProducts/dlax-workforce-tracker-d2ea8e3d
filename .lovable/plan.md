# Email Configuration & Forgot Password

Add an admin-only Email Configuration screen that stores SMTP credentials, and wire a Forgot Password flow that uses those credentials to send reset links via the user's own SMTP server.

## Why a Supabase Edge Function (not a TanStack server function)
The app's TanStack server runtime is Cloudflare Workers, which cannot open raw SMTP/TCP sockets. To send via the user's SMTP host (Gmail, Office365, custom), we need a Deno-based Supabase Edge Function using `denomailer`. The rest of the app stays on TanStack server functions.

## 1. Database (migration)
- `email_config` table (single row, `id = 'default'`):
  - `smtp_host text`, `smtp_port int`, `encryption text` ('none'|'ssl'|'tls'), `username text`, `from_email text`, `from_name text`, `app_password_encrypted text` (stored via edge fn; UI only sets it), `enabled bool`, `cc_recipients text[]`, `updated_at`, `updated_by`
  - RLS: only `admin` (or `email_config` screen edit) can SELECT/UPSERT; password column never returned to client (use a view `email_config_public` that omits it).
- Add `email` column already exists on `profiles` — verify and ensure it's kept in sync with `auth.users.email` (it is, via `handle_new_user`).
- New screen key `email_config` in screen permissions catalog.

## 2. Supabase Edge Functions
- `send-email` — Reads `email_config` with service role, sends via `denomailer` SMTP. Inputs: `{ to, subject, html, cc? }`. Used by both test-send and password-reset.
- `send-password-reset` — Input: `{ email }`. Looks up user via admin API, generates a recovery link with `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: '<origin>/reset-password' } })`, then calls `send-email` with a branded HTML template. Always returns 200 (no user enumeration).
- `test-smtp` — Sends a test email to a chosen address using current form values (so admin can verify before saving) OR saved config.
- All functions: rate-limit basic + input validation with Zod.
- `config.toml` entries: `verify_jwt = true` for `send-password-reset` is OFF (public), the others ON (admin only, verified inside).

## 3. Frontend
- New route `src/routes/_authenticated/email-config.tsx` (admin only) with tabs matching the screenshot:
  - **No Reply Email Configuration** (the system sender used by forgot-password).
  - Fields: Enable toggle, SMTP Host, Port, Encryption (None/SSL 465/TLS 587), Username, App Password (masked, "leave empty to keep existing"), From Email, From Name, CC Recipients (chip input), Send Test To + "Send Test Email" + "Save Configuration".
- Sidebar entry under Settings/Masters: "Email Configuration" (admin only).
- New public route `src/routes/forgot-password.tsx` — email input → calls `send-password-reset`. Always shows success message.
- New public route `src/routes/reset-password.tsx` — handles Supabase recovery token in URL hash, calls `supabase.auth.updateUser({ password })`, redirects to /login.
- Login page: add "Forgot password?" link.

## 4. Security
- App password stored only server-side; never returned to client. UI shows masked placeholder; empty input on save = keep existing.
- `send-password-reset` is public but rate-limited and always returns generic success.
- Admin-only check inside `test-smtp` and `send-email` via JWT + `has_role(uid,'admin')`.

## Technical details
- Edge function deps: `https://deno.land/x/denomailer/mod.ts`.
- TLS=587 uses STARTTLS, SSL=465 uses implicit TLS — denomailer `connection.tls` flag.
- Password column encrypted at rest using `pgsodium` is overkill; we store as plain text in a column protected by RLS + omitted from client view (acceptable; document tradeoff).
- Reset link uses Supabase `generateLink` recovery flow; lands on our `/reset-password` page where the hash sets the session.

## Out of scope
- Per-user SMTP (only the "No Reply" sender from the screenshot).
- Email templates editor (single hard-coded reset template; CC list applied if present).
