## Plan

Fix the daily entry save error by adding the missing `sheet_type` database schema expected by the app.

### 1. Add an idempotent database migration
Create a migration that safely runs on existing installations and new deployments:

```sql
ALTER TABLE public.daily_manpower
ADD COLUMN IF NOT EXISTS sheet_type text NOT NULL DEFAULT 'daily';

ALTER TABLE public.daily_manpower_sheets
ADD COLUMN IF NOT EXISTS sheet_type text NOT NULL DEFAULT 'daily';
```

### 2. Align sheet assignment logic
Ensure the existing `assign_daily_sheet()` function uses `sheet_type` when finding or creating a sheet, so Daily and OT sheets do not collide for the same project/date.

### 3. Restore uniqueness for project/date/sheet type
Add or replace uniqueness constraints/indexes so only one sheet exists per:

```text
project_id + entry_date + sheet_type
```

This prevents duplicate sheet headers while still allowing separate Daily and OT sheets.

### 4. Refresh the API schema cache
Include:

```sql
NOTIFY pgrst, 'reload schema';
```

This addresses the exact `PGRST204` schema cache error after migration.

### 5. Provide self-hosted execution notes
After approval, I will give you the exact migration SQL/file content. On the self-hosted server, run it against the database, then restart/reload the REST API container if the error remains.