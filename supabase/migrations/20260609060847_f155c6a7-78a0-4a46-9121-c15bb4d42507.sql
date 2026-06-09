CREATE OR REPLACE FUNCTION public.get_globally_assigned_contractor_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT contractor_id FROM public.project_contractors WHERE contractor_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_globally_assigned_contractor_ids() TO authenticated;