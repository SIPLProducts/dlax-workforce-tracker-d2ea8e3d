## Progress

GoTrue migrations now succeed (the `postgres` role fix worked). New failure:

```
ERROR: publication "supabase_realtime" does not exist
STATEMENT: ALTER PUBLICATION supabase_realtime ADD TABLE public.contractors;
```

## Root cause

App migrations call `ALTER PUBLICATION supabase_realtime ADD TABLE …` to enable Realtime on tables. Hosted Supabase pre-creates this publication; our self-hosted stack doesn't (we have no realtime container, and the db image doesn't ship the publication on a fresh volume). Editing 19+ app migrations is not the right fix — we should provide the publication so the migrations run as-written.

## Fix

Edit only **`supabase-stack/volumes/db/init/00-roles.sh`**. Append at the end of the SQL block:

```sql
CREATE PUBLICATION supabase_realtime;
```

Wrapped in a guard so it's idempotent:

```sql
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END \$\$;
```

This is an empty publication; the `ALTER PUBLICATION … ADD TABLE` calls in our migrations will then populate it. Without a realtime container running, the publication just sits there unused — harmless.

## Re-deploy

```bash
sudo ADMIN_PASSWORD='admin2026' ./install.sh
```

`install.sh` wipes the db volume on every run, so the updated init script will execute on the fresh cluster.

## Files changed

- `supabase-stack/volumes/db/init/00-roles.sh` — add idempotent `CREATE PUBLICATION supabase_realtime`
