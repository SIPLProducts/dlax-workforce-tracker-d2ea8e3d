-- 1) Row status derives from its sheet
CREATE OR REPLACE FUNCTION public.set_daily_manpower_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _sheet_status text;
BEGIN
  SELECT status INTO _sheet_status
  FROM public.daily_manpower_sheets
  WHERE id = NEW.sheet_id;

  NEW.status := CASE _sheet_status
    WHEN 'approved' THEN 'approved'::approval_status
    WHEN 'pending'  THEN 'pending_l1'::approval_status
    WHEN 'rejected' THEN 'rejected'::approval_status
    ELSE 'draft'::approval_status
  END;

  IF NEW.status = 'draft' THEN
    NEW.submitted_by := COALESCE(NEW.submitted_by, NEW.created_by, auth.uid());
  END IF;

  RETURN NEW;
END $function$;

-- Ensure the sheet is assigned before status is derived (alphabetical trigger order)
DROP TRIGGER IF EXISTS trg_daily_manpower_initial_status ON public.daily_manpower;
DROP TRIGGER IF EXISTS trg_set_daily_manpower_initial_status ON public.daily_manpower;
CREATE TRIGGER trg_zz_daily_manpower_initial_status
BEFORE INSERT ON public.daily_manpower
FOR EACH ROW EXECUTE FUNCTION public.set_daily_manpower_initial_status();

-- 2) Propagate sheet status changes to its rows
CREATE OR REPLACE FUNCTION public.sync_rows_with_sheet_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.daily_manpower
       SET status = CASE NEW.status
             WHEN 'approved' THEN 'approved'::approval_status
             WHEN 'pending'  THEN 'pending_l1'::approval_status
             WHEN 'rejected' THEN 'rejected'::approval_status
             ELSE 'draft'::approval_status
           END
     WHERE sheet_id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_sheets_status_sync ON public.daily_manpower_sheets;
CREATE TRIGGER trg_sheets_status_sync
AFTER UPDATE OF status ON public.daily_manpower_sheets
FOR EACH ROW EXECUTE FUNCTION public.sync_rows_with_sheet_status();

-- 3) One-time backfill
UPDATE public.daily_manpower dm
   SET status = CASE s.status
         WHEN 'approved' THEN 'approved'::approval_status
         WHEN 'pending'  THEN 'pending_l1'::approval_status
         WHEN 'rejected' THEN 'rejected'::approval_status
         ELSE 'draft'::approval_status
       END
  FROM public.daily_manpower_sheets s
 WHERE s.id = dm.sheet_id
   AND dm.status IS DISTINCT FROM CASE s.status
         WHEN 'approved' THEN 'approved'::approval_status
         WHEN 'pending'  THEN 'pending_l1'::approval_status
         WHEN 'rejected' THEN 'rejected'::approval_status
         ELSE 'draft'::approval_status
       END;