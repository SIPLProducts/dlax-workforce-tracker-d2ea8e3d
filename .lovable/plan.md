# Disable Leaked-Password Check

The error message "Password is known to be weak and easy to guess, please choose a different one" comes from Supabase Auth's built-in HIBP (Have I Been Pwned) check, which is currently enabled on the project. It is not a client-side validation in our code.

## Change

- Call `supabase--configure_auth` to set `password_hibp_enabled: false` (keeping the other auth settings unchanged: `disable_signup: true`, `external_anonymous_users_enabled: false`, `auto_confirm_email: true`).

After this, any password meeting the minimum 6-character length (our app's own check) will be accepted on the Forgot Password dialog and the User Management edit dialog.

## Not changed

- No code changes.
- Minimum-length check (6 chars) and "passwords must match" check on the Forgot Password dialog stay — without them the form would let through empty or mismatched values.

## Security note

Disabling HIBP means users can pick common/breached passwords (e.g. `password123`). Acknowledged per your request.
