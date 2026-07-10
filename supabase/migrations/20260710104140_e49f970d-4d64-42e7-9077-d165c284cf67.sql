CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_screen_edit(_user_id, 'user_management')
    OR EXISTS (
      SELECT 1
      FROM public.user_projects
      WHERE user_id = _user_id
        AND project_id = _project_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';