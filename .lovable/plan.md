## Plan

1. **Refresh PostgREST schema cache after migrations**
   - After all SQL migration files are applied in `install.sh`, send a schema reload notification to PostgREST using the database connection.
   - Wait briefly for `/rest/v1/rpc/get_email_for_login_id` to become visible before seeding/verifying admin login.

2. **Make the RPC verification self-diagnosing**
   - Before failing, check directly inside the DB whether `public.get_email_for_login_id(text)` exists and whether the `admin` profile row exists.
   - If the RPC is in the database but missing through the REST API, print a clear schema-cache/restart message instead of a generic login failure.

3. **Keep the current URL/port behavior**
   - Continue using `http://<SERVER_IP>:8000` for the backend API and `http://<SERVER_IP>:3000` or port 80 for the app.
   - Do not reintroduce `nip.io` anywhere.

4. **Validate installer syntax**
   - Run a shell syntax check after editing so the next server re-run does not fail on script syntax.

After implementation, you should re-run:

```bash
cd /home/ubuntu/dlax-workforce-tracker-d2ea8e3d-main
sudo SERVER_IP=15.206.37.230 ADMIN_LOGIN_ID=admin ADMIN_PASSWORD='admin123456' ./install.sh
```