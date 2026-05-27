
## Root cause

The error chain is the same every run:

```text
psql: FATAL: role "postgres" does not exist     ← repair-db-roles.sh
FATAL: password authentication failed for user "supabase_auth_admin"  ← dlax-auth
```

Two real problems in the v7 scripts:

1. **`repair-db-roles.sh` runs `psql` on the host.** The host has its own local Postgres socket at `/run/postgresql/.s.PGSQL.5432` with no `postgres` role. The repair never touches the Supabase DB container at all, so `supabase_auth_admin`'s password is never reset and `dlax-auth` keeps failing SASL auth.

2. **The existing DB volume was initialized with an old `POSTGRES_PASSWORD`.** Even when repair does reach the right server, it tries to log in as `postgres` with the *new* `.env` password, which the existing volume does not accept. There is no fallback path and no clear auto-recovery.

The earlier "wipe it" advice worked once, but the installer should handle this itself instead of leaving the user to run manual `docker volume rm` commands.

## Plan for v8

### 1. Rewrite `scripts/repair-db-roles.sh` to run inside the DB container

- Resolve project root and load `.env` safely (no `source`, no word-splitting).
- Use `docker compose -f <root>/docker-compose.yml --env-file <root>/.env exec -T db ...` for every Postgres command.
- Connect as the container's bootstrap superuser over the local UNIX socket inside the container — that path always works regardless of `POSTGRES_PASSWORD` drift:

  ```text
  docker compose exec -T db \
    psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f -
  ```

- Pipe a single SQL script that:
  - `ALTER ROLE postgres WITH PASSWORD :'pw'`
  - `ALTER ROLE supabase_admin WITH PASSWORD :'pw'`
  - `ALTER ROLE supabase_auth_admin WITH PASSWORD :'pw'`
  - `ALTER ROLE supabase_storage_admin WITH PASSWORD :'pw'`
  - `ALTER ROLE authenticator WITH PASSWORD :'pw'`
  - `ALTER ROLE pgbouncer WITH PASSWORD :'pw'` (if present)
  - Creates `postgres` role if it does not exist (older volumes).
- Pass the password via `psql -v pw="$POSTGRES_PASSWORD"` so quoting is safe.
- Exit codes: `0` ok, `2` could not reach container, `3` could not authenticate even as bootstrap superuser (means volume password is unknown).

### 2. Rewrite `scripts/reset-db-volume.sh`

- Self-locate project root.
- `docker compose down` (no `-v`) first, then explicit `docker volume rm -f` for both DB and storage volumes resolved from `docker compose config --volumes` so it works no matter what the Compose project name is (`dlax-supabase`, `backend`, etc.).
- Print a single-line confirmation and exit cleanly.

### 3. Rewrite `install.sh` recovery flow

Replace the current fragile sequence with:

```text
1. ensure .env exists and has all required secrets (auto-generate if missing)
2. docker compose up -d db
3. wait for db healthcheck (pg_isready inside the container)
4. run repair-db-roles.sh
   - exit 0 → continue
   - exit 3 → password mismatch with existing volume:
        if --yes or DLAX_AUTO_RESET=1 → run reset-db-volume.sh, then loop once
        else → print exact recovery commands and stop
5. docker compose up -d (everything else)
6. wait for auth, rest, storage health
```

- Stream the full repair log to both `/var/log/dlax-install.log` and the console so the real failure is never hidden again.
- Pass `--yes` through end-to-end so an unattended re-install on a fresh box just works.

### 4. README troubleshooting update

Add the exact symptom block and the one-command recovery:

```text
Symptom:
  password authentication failed for user "supabase_auth_admin"

Recovery (no data to keep):
  sudo bash /root/DLAX/backend/scripts/reset-db-volume.sh
  sudo bash /root/DLAX/backend/install.sh --yes
```

### 5. Deliverable

Build and provide:

```text
/mnt/documents/dlax-selfhost-complete-v8.zip
```

## Expected result

- On a fresh box: `install.sh --yes` completes end-to-end, `dlax-auth` becomes healthy on the first try.
- On a box with an old DB volume: repair runs inside the container, resets `supabase_auth_admin` from `.env`, and `dlax-auth` recovers without any manual `docker volume rm`.
- On a truly unknown-password volume: installer stops with a single clear instruction instead of a generic warning.
