-- project_contractors
DROP POLICY IF EXISTS "Project editors manage project_contractors" ON public.project_contractors;
CREATE POLICY "Manage project_contractors"
ON public.project_contractors FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_screen_edit(auth.uid(), 'masters_projects')
  OR (public.has_screen_edit(auth.uid(), 'masters_contractors')
      AND public.has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_screen_edit(auth.uid(), 'masters_projects')
  OR (public.has_screen_edit(auth.uid(), 'masters_contractors')
      AND public.has_project_access(auth.uid(), project_id))
);

-- project_departments
DROP POLICY IF EXISTS "Project editors manage project_departments" ON public.project_departments;
CREATE POLICY "Manage project_departments"
ON public.project_departments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_screen_edit(auth.uid(), 'masters_projects')
  OR (public.has_screen_edit(auth.uid(), 'masters_departments')
      AND public.has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_screen_edit(auth.uid(), 'masters_projects')
  OR (public.has_screen_edit(auth.uid(), 'masters_departments')
      AND public.has_project_access(auth.uid(), project_id))
);

-- project_categories
DROP POLICY IF EXISTS "Project editors manage project_categories" ON public.project_categories;
CREATE POLICY "Manage project_categories"
ON public.project_categories FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_screen_edit(auth.uid(), 'masters_projects')
  OR (public.has_screen_edit(auth.uid(), 'masters_categories')
      AND public.has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_screen_edit(auth.uid(), 'masters_projects')
  OR (public.has_screen_edit(auth.uid(), 'masters_categories')
      AND public.has_project_access(auth.uid(), project_id))
);