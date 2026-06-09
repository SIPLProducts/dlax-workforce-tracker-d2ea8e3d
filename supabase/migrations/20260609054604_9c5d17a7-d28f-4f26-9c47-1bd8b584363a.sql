
-- project_contractors
DROP POLICY IF EXISTS "Manage project_contractors" ON public.project_contractors;
CREATE POLICY "Manage project_contractors" ON public.project_contractors FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_projects')
  OR (has_screen_edit(auth.uid(), 'masters_contractors') AND has_project_access(auth.uid(), project_id))
  OR (has_role(auth.uid(), 'project_coordinator'::app_role) AND has_project_access(auth.uid(), project_id))
  OR (has_screen_edit(auth.uid(), 'masters_assignments') AND has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_projects')
  OR (has_screen_edit(auth.uid(), 'masters_contractors') AND has_project_access(auth.uid(), project_id))
  OR (has_role(auth.uid(), 'project_coordinator'::app_role) AND has_project_access(auth.uid(), project_id))
  OR (has_screen_edit(auth.uid(), 'masters_assignments') AND has_project_access(auth.uid(), project_id))
);

-- project_departments
DROP POLICY IF EXISTS "Manage project_departments" ON public.project_departments;
CREATE POLICY "Manage project_departments" ON public.project_departments FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_projects')
  OR (has_screen_edit(auth.uid(), 'masters_departments') AND has_project_access(auth.uid(), project_id))
  OR (has_role(auth.uid(), 'project_coordinator'::app_role) AND has_project_access(auth.uid(), project_id))
  OR (has_screen_edit(auth.uid(), 'masters_assignments') AND has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_projects')
  OR (has_screen_edit(auth.uid(), 'masters_departments') AND has_project_access(auth.uid(), project_id))
  OR (has_role(auth.uid(), 'project_coordinator'::app_role) AND has_project_access(auth.uid(), project_id))
  OR (has_screen_edit(auth.uid(), 'masters_assignments') AND has_project_access(auth.uid(), project_id))
);

-- project_categories
DROP POLICY IF EXISTS "Manage project_categories" ON public.project_categories;
CREATE POLICY "Manage project_categories" ON public.project_categories FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_projects')
  OR (has_screen_edit(auth.uid(), 'masters_categories') AND has_project_access(auth.uid(), project_id))
  OR (has_role(auth.uid(), 'project_coordinator'::app_role) AND has_project_access(auth.uid(), project_id))
  OR (has_screen_edit(auth.uid(), 'masters_assignments') AND has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_projects')
  OR (has_screen_edit(auth.uid(), 'masters_categories') AND has_project_access(auth.uid(), project_id))
  OR (has_role(auth.uid(), 'project_coordinator'::app_role) AND has_project_access(auth.uid(), project_id))
  OR (has_screen_edit(auth.uid(), 'masters_assignments') AND has_project_access(auth.uid(), project_id))
);

-- contractors (master)
DROP POLICY IF EXISTS "Admins or contractor-editors manage contractors" ON public.contractors;
CREATE POLICY "Admins or contractor-editors manage contractors" ON public.contractors FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_contractors')
  OR has_role(auth.uid(), 'project_coordinator'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_assignments')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_contractors')
  OR has_role(auth.uid(), 'project_coordinator'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_assignments')
);

-- departments (master)
DROP POLICY IF EXISTS "Admins or department-editors manage departments" ON public.departments;
CREATE POLICY "Admins or department-editors manage departments" ON public.departments FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_departments')
  OR has_role(auth.uid(), 'project_coordinator'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_assignments')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_departments')
  OR has_role(auth.uid(), 'project_coordinator'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_assignments')
);

-- worker_categories (master)
DROP POLICY IF EXISTS "Admins or category-editors manage worker_categories" ON public.worker_categories;
CREATE POLICY "Admins or category-editors manage worker_categories" ON public.worker_categories FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_categories')
  OR has_role(auth.uid(), 'project_coordinator'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_assignments')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_categories')
  OR has_role(auth.uid(), 'project_coordinator'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_assignments')
);
