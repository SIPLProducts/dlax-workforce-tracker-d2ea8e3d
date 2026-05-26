DROP POLICY IF EXISTS "Users view assigned projects" ON public.projects;

CREATE POLICY "View projects"
ON public.projects FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_projects')
  OR has_project_access(auth.uid(), id)
);