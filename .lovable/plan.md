## Plan: v17.2 fix for `supabase_auth_admin` password failure

The current failure means the database role `supabase_auth_admin` exists, but its password does not match the password used by the `dlax-auth` container.

I will update the self-host package so the database role passwords are repaired before Auth starts.

## Changes to make

1. **Replace the role init logic with a reliable password-reset init script**
   - Use a Postgres init shell script instead of only SQL.
   - Read `POSTGRES_PASSWORD` from the container environment.
   - Force-reset passwords for these service login roles on fresh DB volume startup:
     - `supabase_auth_admin`
     - `supabase_storage_admin`
     - `supabase_admin`
     - `authenticator`
   - Keep `anon`, `authenticated`, and `service_role` as non-login API roles.

2. **Add an explicit repair step before starting Auth**
   - Start only the database first.
   - Run `ALTER ROLE ... PASSWORD ...` from inside the `dlax-db` container as the real database superuser.
   - Only then start `dlax-auth`, `dlax-rest`, `dlax-meta`, and `dlax-studio`.
   - This handles both fresh and partially-created volumes.

3. **Keep Studio-only behavior unchanged**
   - `--studio-only` will still skip all DLAX app migrations.
   - `--studio-only` will still skip seed data.
   - You will continue applying migrations manually in Studio as requested.

4. **Improve troubleshooting output**
   - If Auth still fails, show exact commands to inspect role passwords/startup logs.
   - Keep the installer focused on getting Studio and Auth healthy.

## After approval, I will rebuild the zip

I will produce a corrected `dlax-selfhost-complete-v17.zip` package versioned as v17.2.

## Commands you will run after downloading the new zip

```bash
cd /home/ubuntu
rm -rf dlax-selfhost-supabase
unzip -o dlax-selfhost-complete-v17.zip -d dlax-selfhost-supabase
cd dlax-selfhost-supabase
sudo bash scripts/reset-db-volume.sh
sudo bash install.sh --yes --studio-only
```

Expected result: `dlax-auth` starts successfully, Studio opens, and no DLAX migrations or seed data are applied automatically.