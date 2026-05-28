## Diagnosis
The app login flow is User ID based: `admin` is first resolved through `get_email_for_login_id('admin')`, then the returned email is used for password login.

The likely break is in the local installer seed step: it creates the auth user, but it does not verify that the profile row has `login_id = admin`, that the user has the `admin` role, or that password login works through the same public API URL the browser uses. If the trigger/profile creation failed or Studio-created users were not given a matching `profiles.login_id`, the UI will always show “Invalid User ID or password”.

## Plan
1. Harden `install.sh` admin seeding:
   - After creating the auth user, read the created user id/email.
   - Upsert `public.profiles` with `login_id = admin`, `email = admin@dlax.local`, and display name.
   - Upsert `public.user_roles` with `role = admin` for that user.
   - This makes the printed `App admin login: admin / admin123456` actually match the app’s User ID login flow.

2. Add installer verification checks:
   - Call `/rest/v1/rpc/get_email_for_login_id` using the generated anon key and assert it returns the admin email.
   - Call `/auth/v1/token?grant_type=password` with the admin email/password and assert auth succeeds.
   - If either check fails, stop the install with a clear error before printing “DLAX is up”.

3. Keep direct IP:port URLs enforced:
   - Keep `VITE_SUPABASE_URL=http://15.206.37.230:8000` generated at build time.
   - Keep the existing `nip.io` build-output guard.
   - Add a short printed reminder that app users must login with User ID (`admin`), not the email address, unless their `profiles.login_id` is set to that value.

4. Deployment steps after approval:
   - Update `install.sh` only.
   - You will re-run:
     ```bash
     cd /home/ubuntu/dlax-workforce-tracker-d2ea8e3d-main
     sudo SERVER_IP=15.206.37.230 ADMIN_LOGIN_ID=admin ADMIN_PASSWORD='admin123456' ./install.sh
     ```
   - Then hard-refresh the browser and login with:
     ```text
     User ID: admin
     Password: admin123456
     ```

## Important note
Users created manually in Studio must have both:
- an auth user with email/password, and
- a matching row in `public.profiles` where `login_id` is the value typed on the login page.

Assigning only an admin role is not enough for this app’s User ID login.