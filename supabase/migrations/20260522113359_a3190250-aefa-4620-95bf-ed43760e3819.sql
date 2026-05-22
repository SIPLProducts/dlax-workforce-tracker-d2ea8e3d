-- Allow custom-role users with screen edit permission to manage app data,
-- while keeping role/permission management strictly admin-only.

-- 1. has_project_access: dynamic admins (user_management edit, no project assignments) see all projects
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_projects
      WHERE user_id = _user_id AND project_id = _project_id
    )
    OR (
      (public.has_role(_user_id, 'admin'::app_role) OR public.has_screen_edit(_user_id, 'user_management'))
      AND NOT EXISTS (
        SELECT 1 FROM public.user_projects WHERE user_id = _user_id
      )
    );
$$;

-- 2. profiles
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins or user-mgr can manage profiles"
ON public.profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'));

-- 3. user_roles: allow non-admin rows for screen-edit users; admin rows remain admin-only
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "User-mgr manage non-admin roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_screen_edit(auth.uid(), 'user_management') AND role <> 'admin'::app_role)
WITH CHECK (public.has_screen_edit(auth.uid(), 'user_management') AND role <> 'admin'::app_role);

-- 4. user_projects
DROP POLICY IF EXISTS "Admins manage user_projects" ON public.user_projects;
CREATE POLICY "Admins or user-mgr manage user_projects"
ON public.user_projects FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'));

-- 5. project_approval_config
DROP POLICY IF EXISTS "Admins manage approval config" ON public.project_approval_config;
CREATE POLICY "Admins or approval-mgr manage approval config"
ON public.project_approval_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_approval_config'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_approval_config'));

-- 6. projects
DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Project editors can insert projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_projects'));
CREATE POLICY "Project editors can update projects"
ON public.projects FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_projects'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_projects'));
CREATE POLICY "Project editors can delete projects"
ON public.projects FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_projects'));

-- 7. contractors
DROP POLICY IF EXISTS "Admins can manage contractors" ON public.contractors;
CREATE POLICY "Admins or contractor-editors manage contractors"
ON public.contractors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_contractors'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_contractors'));

-- 8. departments
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins or department-editors manage departments"
ON public.departments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_departments'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_departments'));

-- 9. worker_categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.worker_categories;
CREATE POLICY "Admins or category-editors manage worker_categories"
ON public.worker_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_categories'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_categories'));

-- 10. department_categories
DROP POLICY IF EXISTS "Admins can manage department_categories" ON public.department_categories;
CREATE POLICY "Admins or category-editors manage department_categories"
ON public.department_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_categories'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'masters_categories'));

-- 11. list_assignable_projects: dynamic admins can also list projects
CREATE OR REPLACE FUNCTION public.list_assignable_projects()
RETURNS TABLE(id uuid, name text, code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.name, p.code
  FROM public.projects p
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_screen_edit(auth.uid(), 'user_management')
  ORDER BY p.name;
$$;