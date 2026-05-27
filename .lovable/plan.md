## What is happening

The installer is stuck at:

```text
[repair-db-roles] waiting for db to accept connections…
```

This means the `dlax-db` container is not reaching a usable Postgres-ready state. In the v9 package, the recovery script waits for `pg_isready`, but the DB container can stay unavailable because the fresh bootstrap path still has a role/healthcheck ordering problem:

- `docker-compose.yml` healthcheck checks `pg_isready -U postgres`, but the Supabase Postgres image initializes with `supabase_admin` first.
- The custom init SQL tries to create/alter `postgres` and internal roles during first boot, but if that init path fails or takes too long, `repair-db-roles.sh` only waits and does not print live DB logs while waiting.
- The install flow depends on repairing roles before starting the full stack, so it appears frozen.

Do I know what the issue is? Yes: the DB bootstrap and readiness checks are still tied to the wrong role/phase. The installer must not wait silently on `postgres` readiness before the `postgres` role is guaranteed to exist.

## Plan for v10 fix

1. **Change DB readiness detection**
   - Update `repair-db-roles.sh` to wait for the container process and socket using `supabase_admin` / generic server readiness first, not `postgres`.
   - Add a hard timeout with progress output every few seconds.
   - If timeout occurs, print `docker logs dlax-db --tail=120` immediately so the real bootstrap error is visible.

2. **Make DB healthcheck bootstrap-safe**
   - Change the `db` healthcheck in `docker-compose.yml` from `pg_isready -U postgres -h localhost` to a bootstrap-safe check that does not require the `postgres` role before init completes.
   - Only verify `postgres` password login after role repair succeeds.

3. **Fix first-boot role initialization**
   - Simplify `volumes/db/init/00-roles.sql` so it does not rely on fragile shell/backtick expansion inside psql init.
   - Keep first-boot SQL minimal: create required roles only if missing, with safe password assignment.
   - Move non-critical ownership/default privilege alignment into `repair-db-roles.sh`, where `.env` values are controlled.

4. **Make repair non-hanging**
   - Add explicit states:
     - container not running
     - Postgres process not accepting connections
     - bootstrap superuser unavailable
     - role SQL failed
     - final password verification failed
   - Return clear exit codes for each state so `install.sh --yes` can recover correctly.

5. **Update install recovery**
   - On fresh wipe, start only `db`, wait with the new bounded wait function, repair roles, then start the rest.
   - If the DB still fails after wipe, stop and show exact DB logs instead of looping.

6. **Regenerate package**
   - Produce a new artifact: `dlax-selfhost-complete-v10.zip`.
   - Include README troubleshooting for this exact stuck line and the one-command recovery:

```bash
sudo bash install.sh --yes
```

## Expected result

With v10, the installer will either:

- complete the DB bootstrap, create/align `postgres`, `supabase_auth_admin`, `authenticator`, and other internal roles, then start all services; or
- fail quickly with the actual `dlax-db` bootstrap logs instead of hanging at `waiting for db to accept connections…`.