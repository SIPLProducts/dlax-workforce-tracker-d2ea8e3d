# Remove the leftover edge function

## Why
All email sending in the app already runs through TanStack server functions (no edge functions involved):

- Forgot Password (OTP) → `requestPasswordOtp` / `verifyPasswordOtpAndReset` in `src/lib/password-reset.functions.ts`
- Email Config "Send Test Email" → `sendEmail` in `src/lib/email.functions.ts`

Both use `nodemailer` against the SMTP credentials stored in `email_config`. Nothing in the codebase calls the edge function `send-password-reset` anymore — it's a leftover from an earlier implementation.

## Changes

1. **Delete** the edge function folder `supabase/functions/send-password-reset/` (removes `index.ts`).
2. **Delete** the `[functions.send-password-reset]` block from `supabase/config.toml`, leaving only `project_id`.
3. **Undeploy** the function from Lovable Cloud using `supabase--delete_edge_functions` so the published worker is also removed.

## Not changing
- No changes to `password-reset.functions.ts`, `email.functions.ts`, `login.tsx`, or `email-config.tsx` — they already use TanStack server functions exclusively.
- No DB / RLS / schema changes.

## Result
Zero edge functions in the project. All outbound email (password reset OTP + admin test email) runs through TanStack server functions on your production server, using the SMTP settings on the Email Configuration screen.
