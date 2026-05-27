## What's failing now

The database and role passwords are fine. Auth (GoTrue) now starts, connects, and begins running its built-in migrations — but it crashes on:

```
/usr/local/etc/auth/migrations/20240729123726_add_mfa_phone_config.up.sql
ERROR: type "auth.factor_type" does not exist
```

`auth.factor_type` is supposed to be created by an earlier GoTrue migration (`20220114185221_…`). The fact that a later migration runs while the type is missing means GoTrue's migration tracker (`auth.schema_migrations`) believes the earlier migration already ran. That only happens when **something other than GoTrue pre-created the `auth` schema and/or partially populated it**.

In our current package, `volumes/db/init/00-roles.sh` does:

```
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
```

That is the culprit. Combined with `supabase/postgres`'s own bootstrap, GoTrue ends up with an `auth` schema in a state it didn't build itself, so its migrator skips ahead and then hits the missing enum.

## Fix plan for v17.3

1. **Stop pre-creating `auth` and `storage` schemas.**
   - Remove the `CREATE SCHEMA … AUTHORIZATION …` lines from `volumes/db/init/00-roles.sh`.
   - Keep only role creation + password sync in that script.
   - GoTrue and Storage will create and own their own schemas on first start, and their migrations will run in the correct order from zero.

2. **Keep `scripts/sync-roles.sh` and the install-time password reset.**
   - That part is correct and is what finally got Auth to connect.
   - No changes needed there.

3. **Harden `reset-db-volume.sh`.**
   - Also remove `dlax-supabase_storage-data` (and any other named volume the stack created) so a re-install always starts from a truly clean slate. This prevents a half-migrated `auth` schema from a previous failed run sticking around and reproducing this exact error.

4. **Install flow stays the same and stays studio-only.**
   - `install.sh --yes --studio-only` will:
     1. Bring up `dlax-db`.
     2. Run `sync-roles.sh` to align service-role passwords with `.env`.
     3. Bring up `auth`, `rest`, `meta`, `kong`, `storage`, `studio`.
     4. Wait for `auth` to report healthy.
   - No DLAX app migrations, no seed data — you still apply those manually in Studio, as requested.

5. **Better failure output.**
   - If `auth` still fails to come healthy, print the last 50 log lines from `dlax-auth` and the exact commands to inspect `auth.schema_migrations` and re-run `sync-roles.sh`.

## Files that will change

- `volumes/db/init/00-roles.sh` — remove `CREATE SCHEMA auth/storage` blocks.
- `scripts/reset-db-volume.sh` — also remove `dlax-supabase_storage-data` and any other stack-created named volumes.
- `install.sh` — minor: improve the auth-healthcheck failure message; bump VERSION to `17.3.0`.
- Repackage as `dlax-selfhost-complete-v17.zip` (v17.3).

## Commands you will run after downloading the new zip

```bash
cd /home/ubuntu
rm -rf dlax-selfhost-supabase
unzip -o dlax-selfhost-complete-v17.zip -d dlax-selfhost-supabase
cd dlax-selfhost-supabase
sudo bash scripts/reset-db-volume.sh
sudo bash install.sh --yes --studio-only
```

Expected result: a fully healthy self-hosted Supabase stack (db, kong, auth, rest, meta, storage, studio) with no DLAX migrations applied yet, ready for you to apply migrations manually in Studio.
