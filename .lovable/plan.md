## Goal

Replace the current "Forgot password" dialog (which asks for User ID + new password directly) with an **email-based OTP flow**:

1. User clicks "Forgot password?" on `/login`.
2. Enter registered email → server checks if it exists on a profile.
   - If not found → toast error "No account found with this email".
3. If found → generate a 6-digit OTP, store it, send via SMTP from `email_config`.
4. User enters OTP + new password → server verifies OTP and updates the auth password.

No edge functions. All logic in TanStack server functions, reusing `sendEmail` (`src/lib/email.functions.ts`) and the SMTP config in `public.email_config`.

## Database

Migration adds one table for OTPs:

```text
public.password_reset_otps
  id            uuid pk
  user_id       uuid not null  (auth.users.id)
  email         text not null  (lowercased)
  otp_hash      text not null  (sha256, never store raw OTP)
  expires_at    timestamptz    (now() + 10 min)
  attempts      int default 0  (cap at 5)
  consumed_at   timestamptz null
  created_at    timestamptz default now()
  index on (email, created_at desc)
```

- RLS enabled, **no policies** (only service-role server fns touch it).
- GRANTs: `service_role` only (no anon/authenticated).
- Rate limit in code: reject if a non-consumed OTP for that email was issued < 60s ago.

## Server functions (new file `src/lib/password-reset.functions.ts`)

All public (no auth middleware), all use `supabaseAdmin` loaded inside the handler:

1. **`requestPasswordOtp({ email })`**
   - Validate email format.
   - Look up `profiles` by `contact_email` (preferred) or fallback to `auth.users.email` for legacy accounts.
   - If no match → throw `"No account found with this email"` (user asked for explicit alert; we accept the enumeration trade-off here).
   - Invalidate any prior unconsumed OTPs for that email.
   - Generate 6-digit OTP, hash with sha256, insert row with 10-min expiry.
   - Call existing `sendEmail` server fn internally (or inline nodemailer using `email_config`) to send a branded "Your DLAX password reset code is **123456**" email.
   - Return `{ ok: true }`.

2. **`verifyPasswordOtpAndReset({ email, otp, newPassword })`**
   - Validate inputs (`otp` is 6 digits, password >= 6 chars).
   - Fetch latest unconsumed OTP for email; check not expired, attempts < 5.
   - Compare hash; on mismatch increment attempts, throw `"Invalid or expired code"`.
   - On match: mark `consumed_at = now()`, call `supabaseAdmin.auth.admin.updateUserById(user_id, { password })`.
   - Return `{ ok: true }`.

Both work on self-hosted Supabase since they only use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + the SMTP row.

## UI changes (`src/routes/login.tsx`)

Replace the existing forgot-password dialog body with a 2-step flow inside the same `Dialog`:

- **Step 1 — Request code**: Email input + "Send code" button.
- **Step 2 — Verify & reset**: OTP input (6 digits), new password, confirm password, "Reset password" button. "Resend code" link with 30s cooldown.
- On success: toast "Password updated. Please sign in.", close dialog, prefill nothing (email isn't the User ID).

Remove `resetPasswordByUserId` usage from this dialog (keep the server fn file untouched for now; we can delete later).

## Files touched

- new: `supabase/migrations/<ts>_password_reset_otps.sql`
- new: `src/lib/password-reset.functions.ts`
- edit: `src/routes/login.tsx` (dialog body + handlers + state)

## Open questions

1. **OTP email lookup field**: Use `profiles.contact_email` only (the new field we added), or also fall back to `auth.users.email` so legacy users created before contact_email can still reset? I plan to **check both** unless you say otherwise.
2. **User enumeration**: You asked for an explicit "email doesn't exist" alert, which reveals whether an email is registered. Confirming this is the intended behaviour (vs. the more secure "If the email exists, a code has been sent").
