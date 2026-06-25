## Cause

`public.email_config` row is filled (Gmail SMTP, app password, from address) but the **Enabled** toggle on `/email-config` is `false`. My `sendOtpEmail` helper in `src/lib/password-reset.functions.ts` treats `enabled=false` as "not configured" and aborts with the misleading message.

## Fix (single file: `src/lib/password-reset.functions.ts`)

Drop the `enabled` gate from the password-reset email path. Password reset is a security-critical flow that should work whenever valid SMTP credentials exist; the toggle is meaningful for opt-in notification mail, not for auth recovery. Keep the credential checks so a truly empty config still fails clearly.

Change in `sendOtpEmail`:

```ts
if (!cfg) throw new Error("Email is not configured. Please contact your administrator.");
if (!cfg.smtp_host || !cfg.from_email || !cfg.app_password) {
  throw new Error("Email configuration is incomplete. Please contact your administrator.");
}
// remove the `!cfg.enabled` branch
```

No DB changes, no UI changes. After this, the existing Gmail config sends the OTP immediately.

## Optional follow-up (not in this change)

If you'd rather keep `enabled` as a hard switch, I can instead auto-enable the row when SMTP fields are saved on `/email-config`, or surface a clearer toast pointing to the toggle. Tell me which you prefer.