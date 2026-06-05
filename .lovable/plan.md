## What we know

- `[ ok ] Data API grants applied` printed, so the heredoc completed without `ON_ERROR_STOP` aborting — the `GRANT ... TO authenticated` statements ran.
- The very next line failed: `grant verification failed: authenticated lacks SELECT on public.user_roles`.
- Migrations don't change ownership, and the install script runs migrations as `-U postgres` (a SUPERUSER per `00-roles.sh`), so `postgres` owns `public.user_roles` and the GRANT statement is legal.

Given those facts, the most likely real cause is that the verification probe is not actually returning a clean `t`/`f` — it's returning empty or extra text, so the bash equality check fails. The grants probably did apply.

## Fix (one file: `install.sh`)

Replace the current "verification" step with a diagnostic block that:

1. Captures both stdout and stderr of the probe and shows the raw value before deciding.
2. Tries the same check two ways and prints what it sees, so the next run actually tells us what's wrong instead of dying with a generic message:
   ```bash
   RAW=$(docker exec --user postgres "$DB_CONTAINER" \
     psql -tAXU postgres -d postgres \
     -c "SELECT has_table_privilege('authenticated','public.user_roles','SELECT')::text" 2>&1)
   log "  has_table_privilege => [$RAW]"

   GRANTS=$(docker exec --user postgres "$DB_CONTAINER" \
     psql -tAXU postgres -d postgres \
     -c "SELECT string_agg(privilege_type, ',') FROM information_schema.role_table_grants
         WHERE grantee='authenticated' AND table_schema='public' AND table_name='user_roles'" 2>&1)
   log "  role_table_grants  => [$GRANTS]"
   ```
3. Treats either signal as success: pass if `RAW` ends with `t` OR `GRANTS` contains `SELECT`.
4. Only fails (with `die`) when BOTH signals say the privilege is missing. In that case, dump the table owner so we can see if a future migration changed ownership:
   ```bash
   docker exec --user postgres "$DB_CONTAINER" psql -tAXU postgres -d postgres -c \
     "SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename='user_roles'"
   ```

The `-X` flag is added to skip `~/.psqlrc` (avoids any stray output from container config). The previous probe used `-tA` only.

## If the diagnostic confirms the grants are genuinely missing

(Not expected, but the plan covers it.) Add an explicit re-grant block at the end that runs as the table owner. We capture the owner role per-table and `GRANT ... TO authenticated, service_role` while connected as that owner via `SET ROLE`:

```sql
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND n.nspname='public'
  LOOP
    EXECUTE format('SET LOCAL ROLE %I', t.owner);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
    RESET ROLE;
  END LOOP;
END $$;
```

This is safe because `postgres` is SUPERUSER and can `SET ROLE` to any table owner.

## Out of scope

- App code unchanged.
- Existing grants block stays — we're only improving verification and adding the owner-aware fallback.

## After you pull and rerun

```bash
sudo bash install.sh
```

The install will print the actual `has_table_privilege` value and the row from `information_schema.role_table_grants` for `user_roles`. If it still fails, paste those two lines and we'll know exactly which assumption is wrong.
