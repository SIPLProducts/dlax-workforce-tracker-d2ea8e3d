## Problem

Clicking **Send Test Email** returns `Email sending is not enabled`. Root cause:

- The edge function `send-email` calls `loadConfig()` which throws when `email_config.enabled = false`.
- The client only sends an inline SMTP override when the user just typed a new app password. If the password is already saved, it relies on server-side config — which is currently disabled.
- Result: you can't test SMTP until you flip the toggle and save, which defeats the purpose of a test button.

## Fix

Edit **`supabase/functions/send-email/index.ts`** only:

1. In `loadConfig`, drop the `if (!data.enabled)` check. Keep the completeness check (host / from / password required).
2. Keep the `enabled` flag meaningful: callers that send *system* emails (password reset, notifications) should check `enabled` themselves before invoking this function. The admin-only test button bypasses that gate intentionally.

No client changes, no schema changes, no new secrets. The function is already admin-gated, so this doesn't widen access.

## Verify

- Save SMTP creds with **Enable No-Reply Sending = OFF**, click **Send Test Email** → expect 200 and the test mail arrives.
- Toggle Enable ON, save, test again → still works.
- Leave host/password empty, test → still fails with "Email configuration is incomplete" (good).
