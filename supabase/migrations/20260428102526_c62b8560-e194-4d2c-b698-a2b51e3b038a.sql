CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_projects
      WHERE user_id = _user_id AND project_id = _project_id
    )
    OR (
      public.has_role(_user_id, 'admin'::app_role)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_projects WHERE user_id = _user_id
      )
    );
$function$;