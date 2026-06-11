
-- 1) Add sheet_type to sheets and rows
ALTER TABLE public.daily_manpower_sheets
  ADD COLUMN IF NOT EXISTS sheet_type text NOT NULL DEFAULT 'daily';
ALTER TABLE public.daily_manpower_sheets
  DROP CONSTRAINT IF EXISTS daily_manpower_sheets_sheet_type_check;
ALTER TABLE public.daily_manpower_sheets
  ADD CONSTRAINT daily_manpower_sheets_sheet_type_check
  CHECK (sheet_type IN ('daily','ot'));

ALTER TABLE public.daily_manpower
  ADD COLUMN IF NOT EXISTS sheet_type text NOT NULL DEFAULT 'daily';
ALTER TABLE public.daily_manpower
  ADD COLUMN IF NOT EXISTS ot_hours numeric(5,2);

-- 2) Replace unique constraints to include sheet_type
ALTER TABLE public.daily_manpower_sheets
  DROP CONSTRAINT IF EXISTS daily_manpower_sheets_project_id_entry_date_key;
ALTER TABLE public.daily_manpower_sheets
  ADD CONSTRAINT daily_manpower_sheets_project_id_entry_date_sheet_type_key
  UNIQUE (project_id, entry_date, sheet_type);

ALTER TABLE public.daily_manpower
  DROP CONSTRAINT IF EXISTS daily_manpower_entry_date_project_id_contractor_id_departme_key;
ALTER TABLE public.daily_manpower
  ADD CONSTRAINT daily_manpower_unique_per_sheet_type
  UNIQUE (entry_date, project_id, contractor_id, department_id, category_id, sheet_type);

-- 3) Update assign_daily_sheet to be sheet_type-aware
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
