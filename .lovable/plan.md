## Plan: fix the installer permanently in v9

The current v8 package still fails after wiping the volume because the fresh database is coming up without a usable `postgres` role, while `repair-db-roles.sh`, health checks, migrations, seed, backup/restore, and several service URLs all assume `postgres` exists.

### 1. Fix fresh database initialization
- Update `docker-compose.yml` for the `db` service to explicitly set:
  - `POSTGRES_USER=postgres`
  - `POSTGRES_DB=postgres`
  - `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`
- This ensures a fresh wiped volume actually creates the `postgres` superuser role.

### 2. Replace fragile DB init SQL
- Replace the current `volumes/db/init/00-roles.sql` logic, because `PASSWORD :'POSTGRES_PASSWORD'` inside a `DO $$ ... $$` block is not reliable for psql variable expansion.
- Use a bootstrap script/SQL pattern that safely creates or updates required internal roles with the generated password:
  - `anon`
  - `authenticated`
  - `service_role`
  - `authenticator`
  - `supabase_admin`
  - `supabase_auth_admin`
  - `supabase_storage_admin`
  - realtime/functions/replication helper roles if present/needed
- Use psql `-v pw=...` plus `SELECT format(..., :'pw') \gexec` so secrets are SQL-quoted safely.

### 3. Rewrite `repair-db-roles.sh` again
- Keep all Postgres commands inside the `db` container.
- Stop assuming the host socket or a local host Postgres instance.
- Detect and report separately:
  - db container not ready
  - `postgres` role missing on an old/corrupt volume
  - password mismatch
  - role alignment SQL failure
- Change the role reset SQL to avoid `:'pw'` inside a dollar-quoted `DO` block.
- After success, restart dependent services only if they exist.

### 4. Improve wipe/reset recovery
- Update `reset-db-volume.sh` to support both:
  - `FORCE=1 sudo bash .../reset-db-volume.sh`
  - `sudo bash .../reset-db-volume.sh --force`
- Improve interactive prompt so typing the wrong word gives clear guidance.
- Remove only the project volumes for `dlax-supabase` and avoid accidentally matching unrelated Docker volumes.

### 5. Update installer flow
- On `install.sh --yes`, if repair fails due to missing `postgres` role or password mismatch, automatically:
  1. stop stack
  2. remove DB/storage volumes
  3. recreate DB with corrected compose/init files
  4. rerun repair
  5. only then start the full stack
- If it still fails, print the exact last DB logs and repair log path instead of generic SASL guidance.

### 6. Update helper scripts for consistency
- Ensure `healthcheck.sh`, `migrate.sh`, `seed.sh`, `backup.sh`, and `restore.sh` all use `docker compose exec -T db` with the `.env` password and the expected `postgres` role.
- Make error messages say when the database was initialized incorrectly and requires a forced wipe.

### 7. Package and deliver
- Generate a new artifact:
  - `dlax-selfhost-complete-v9.zip`
- Include updated README troubleshooting:
  - current symptom: `FATAL: role "postgres" does not exist`
  - current symptom: `password authentication failed for user "supabase_auth_admin"`
  - one-command fresh recovery: `sudo bash install.sh --yes`
  - manual wipe: `FORCE=1 sudo bash /root/DLAX/backend/scripts/reset-db-volume.sh`

### Expected result
After approval, the new v9 package should allow this flow on your EC2 server:

```bash
cd /home/ubuntu/dlax-selfhost-supabase
sudo bash install.sh --yes
```

And after the automatic wipe, the new DB volume should contain the `postgres` role, internal roles should match `.env`, and `dlax-auth` should no longer fail with SASL/password errors.