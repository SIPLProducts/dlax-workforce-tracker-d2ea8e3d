
CREATE TABLE public.project_contractors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  contractor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, contractor_id)
);

CREATE TABLE public.project_departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  department_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, department_id)
);

CREATE TABLE public.project_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, category_id)
);

ALTER TABLE public.project_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;

-- SELECT policies
CREATE POLICY "View project_contractors for accessible projects"
  ON public.project_contractors FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects') OR has_project_access(auth.uid(), project_id));

CREATE POLICY "View project_departments for accessible projects"
  ON public.project_departments FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects') OR has_project_access(auth.uid(), project_id));

CREATE POLICY "View project_categories for accessible projects"
  ON public.project_categories FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects') OR has_project_access(auth.uid(), project_id));

-- ALL (manage) policies
CREATE POLICY "Project editors manage project_contractors"
  ON public.project_contractors FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects'));

CREATE POLICY "Project editors manage project_departments"
  ON public.project_departments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects'));

CREATE POLICY "Project editors manage project_categories"
  ON public.project_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_screen_edit(auth.uid(),'masters_projects'));

CREATE INDEX idx_project_contractors_project ON public.project_contractors(project_id);
CREATE INDEX idx_project_departments_project ON public.project_departments(project_id);
CREATE INDEX idx_project_categories_project ON public.project_categories(project_id);
