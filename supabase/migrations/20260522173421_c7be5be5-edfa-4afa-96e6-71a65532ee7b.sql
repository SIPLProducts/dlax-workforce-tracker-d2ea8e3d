
-- 1. Attach trigger to auto-create / link sheets on row insert
DROP TRIGGER IF EXISTS trg_assign_daily_sheet ON public.daily_manpower;
CREATE TRIGGER trg_assign_daily_sheet
  BEFORE INSERT ON public.daily_manpower
  FOR EACH ROW EXECUTE FUNCTION public.assign_daily_sheet();

-- 2. Attach trigger to set initial per-row status based on project approval config
DROP TRIGGER IF EXISTS trg_set_daily_manpower_initial_status ON public.daily_manpower;
CREATE TRIGGER trg_set_daily_manpower_initial_status
  BEFORE INSERT ON public.daily_manpower
  FOR EACH ROW EXECUTE FUNCTION public.set_daily_manpower_initial_status();

-- 3. Backfill: create sheets for any orphaned daily_manpower rows
DO $$
DECLARE r record;
        sid uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT project_id, entry_date
    FROM public.daily_manpower
    WHERE sheet_id IS NULL
  LOOP
    SELECT id INTO sid FROM public.daily_manpower_sheets
      WHERE project_id = r.project_id AND entry_date = r.entry_date;
    IF sid IS NULL THEN
      INSERT INTO public.daily_manpower_sheets (project_id, entry_date)
        VALUES (r.project_id, r.entry_date) RETURNING id INTO sid;
    END IF;
    UPDATE public.daily_manpower SET sheet_id = sid
      WHERE project_id = r.project_id AND entry_date = r.entry_date AND sheet_id IS NULL;
  END LOOP;
END $$;
