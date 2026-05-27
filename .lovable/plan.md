## Diagnosis

The latest failure is not the same Auth service failure. It happens earlier in `scripts/sync-roles.sh`:

```bash
docker exec -i dlax-db psql -U supabase_admin ...
```

That command asks for a password because it logs in as `supabase_admin`. If the existing DB volume has a bad/stale `supabase_admin` password, the repair script cannot log in to repair it. So the script is trying to fix the lock while using the same locked key.

## Fix plan

1. **Change DB ownership/bootstrap to use the official `postgres` superuser path**
   - Set the database container to initialize with `POSTGRES_USER=postgres`.
   - Keep `POSTGRES_PASSWORD` as the single authoritative password.
   - Update DB healthcheck to use `postgres`, not `supabase_admin`.

2. **Rewrite `scripts/sync-roles.sh` so it never logs in as `supabase_admin`**
   - Run `psql` inside the DB container as the local postgres OS user:
     ```bash
     docker exec -i --user postgres dlax-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres
     ```
   - This uses local container trust/peer access and does not depend on the broken service-role password.
   - Then it resets all required service roles: `authenticator`, `supabase_auth_admin`, `supabase_storage_admin`, `supabase_admin`, plus API roles.

3. **Make the init script match the same rule**
   - `volumes/db/init/00-roles.sh` should run under the official entrypoint with `POSTGRES_USER=postgres`.
   - It should create/reset service roles but should not pre-create `auth` or `storage` schemas.

4. **Harden recovery from old failed installs**
   - Keep `reset-db-volume.sh`, but also make `install.sh` detect a stale/broken DB volume and print a direct reset instruction instead of looping through more misleading auth errors.
   - Add a clear preflight message: if you have already run a previous broken ZIP, run reset before installing.

5. **Repackage as a new `dlax-selfhost-complete-v17.zip`**
   - Version bump to `17.4.0`.
   - Include the same command sequence for you:
     ```bash
     cd /home/ubuntu
     rm -rf dlax-selfhost-supabase
     unzip -o dlax-selfhost-complete-v17.zip -d dlax-selfhost-supabase
     cd dlax-selfhost-supabase/dlax-selfhost-supabase
     sudo bash scripts/reset-db-volume.sh
     sudo bash install.sh --yes --studio-only
     ```

## Expected result

After this change, the installer will not need the stale `supabase_admin` password to repair roles. A clean reset followed by `install.sh` should bring up the self-hosted stack with DB, Auth, REST, Meta, Kong, and Studio ready.