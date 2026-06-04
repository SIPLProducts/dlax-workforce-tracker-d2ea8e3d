
ALTER TABLE public.contractors DROP CONSTRAINT IF EXISTS contractors_contractor_code_unique;

CREATE OR REPLACE FUNCTION public.enforce_unique_contractor_code_per_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _code text;
BEGIN
  SELECT contractor_code INTO _code FROM public.contractors WHERE id = NEW.contractor_id;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.project_contractors pc
    JOIN public.contractors c ON c.id = pc.contractor_id
    WHERE pc.project_id = NEW.project_id
      AND pc.contractor_id <> NEW.contractor_id
      AND lower(c.contractor_code) = lower(_code)
  ) THEN
    RAISE EXCEPTION 'Contractor code "%" already exists in this project', _code
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unique_contractor_code_per_project ON public.project_contractors;
CREATE TRIGGER trg_unique_contractor_code_per_project
BEFORE INSERT OR UPDATE ON public.project_contractors
FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_contractor_code_per_project();
