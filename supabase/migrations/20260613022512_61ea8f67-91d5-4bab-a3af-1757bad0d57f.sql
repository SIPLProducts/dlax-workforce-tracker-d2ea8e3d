-- Add sheet_type to support Daily vs OT sheets
ALTER TABLE public.daily_manpower_sheets
  ADD COLUMN IF NOT EXISTS sheet_type text NOT NULL DEFAULT 'daily';

ALTER TABLE public.daily_manpower
  ADD COLUMN IF NOT EXISTS sheet_type text NOT NULL DEFAULT 'daily';

-- Uniqueness: one sheet per project/date/sheet_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_manpower_sheets_project_id_entry_date_key'
  ) THEN
    ALTER TABLE public.daily_manpower_sheets
      DROP CONSTRAINT daily_manpower_sheets_project_id_entry_date_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS daily_manpower_sheets_project_date_type_uidx
  ON public.daily_manpower_sheets (project_id, entry_date, sheet_type);

-- Ensure assign_daily_sheet uses sheet_type
CREATE OR REPLACE FUNCTION public.assign_daily_sheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _sid uuid;
BEGIN
  IF NEW.sheet_id IS NULL THEN
    SELECT id INTO _sid FROM public.daily_manpower_sheets
      WHERE project_id = NEW.project_id
        AND entry_date = NEW.entry_date
        AND sheet_type = COALESCE(NEW.sheet_type, 'daily');
    IF _sid IS NULL THEN
      INSERT INTO public.daily_manpower_sheets (project_id, entry_date, sheet_type)
        VALUES (NEW.project_id, NEW.entry_date, COALESCE(NEW.sheet_type, 'daily'))
        RETURNING id INTO _sid;
    END IF;
    NEW.sheet_id := _sid;
  END IF;
  RETURN NEW;
END $function$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';