## Root cause

GoTrue v2.158.1's migration runs:
```sql
grant select on auth.<table> to postgres with grant option;
```
…and fails with `ERROR: role "postgres" does not exist (SQLSTATE 42704)`.

The `supabase/postgres:15.6.1.143` image initialises the cluster with `supabase_admin` as the superuser, **not** `postgres`. Our `00-roles.sh` creates `anon`, `authenticated`, `service_role`, `authenticator`, `supabase_auth_admin`, `supabase_storage_admin` — but never creates `postgres`. So GoTrue's first-run migration crashes on a fresh volume, the auth container restart-loops, and `install.sh` hangs on the `/auth/v1/health` probe.

This is purely an init-script bug. Migrations don't need to be applied manually — once `postgres` exists, GoTrue will migrate itself on the next start.

## Fix

Edit **`supabase-stack/volumes/db/init/00-roles.sh`** only. Inside the existing `DO $$ … END $$` block, before the schema/grant section, add:

```sql
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='postgres') THEN
  CREATE ROLE postgres LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS PASSWORD '${PW_ESC}';
END IF;
```

And after the schemas exist, also grant ownership-style access so Storage/Realtime migrations that reference `postgres` work:

```sql
GRANT ALL ON DATABASE postgres TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
```

No other file changes. No app code changes. No docker-compose changes.

## Re-deploy

Because the init script only runs on a **fresh** db volume, the user must wipe the existing volume and re-run install:

```bash
cd /home/ubuntu/dlax-workforce-tracker-d2ea8e3d-main
docker compose -f supabase-stack/docker-compose.yml down -v
sudo ADMIN_PASSWORD='YourPass#2026' ./install.sh
```

(`install.sh` already does `docker compose down -v` + `docker volume rm dlax-supabase_db-data` in its wipe step, so just re-running it is sufficient.)

## Why not apply migrations manually

The failing migrations are GoTrue's internal schema migrations baked into the `supabase/gotrue` image — they're not in our `supabase/migrations/` folder. You can't apply them with `psql` by hand without extracting them from the container. Fixing the missing role lets GoTrue run them itself, which is the supported path.

## Files changed

- `supabase-stack/volumes/db/init/00-roles.sh` — add `CREATE ROLE postgres …` + two grants
