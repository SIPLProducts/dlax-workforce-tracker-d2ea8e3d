CREATE OR REPLACE FUNCTION public.list_assignable_projects()
RETURNS TABLE (id uuid, name text, code text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.name, p.code
  FROM public.projects p
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_assignable_projects() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_assignable_projects() TO authenticated;