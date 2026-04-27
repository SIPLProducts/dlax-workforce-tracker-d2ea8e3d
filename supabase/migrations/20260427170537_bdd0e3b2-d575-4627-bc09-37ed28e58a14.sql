-- 1. user_projects link table
CREATE TABLE IF NOT EXISTS public.user_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_user_projects_user ON public.user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project ON public.user_projects(project_id);

ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage user_projects"
  ON public.user_projects FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own project assignments"
  ON public.user_projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Helper function: admins always pass; others must have an assignment row
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_projects
      WHERE user_id = _user_id AND project_id = _project_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) TO authenticated;

-- 3. Tighten RLS on projects: SELECT scoped to assigned projects
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
CREATE POLICY "Users view assigned projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), id));

-- 4. daily_manpower: scope select / insert / update by project access
DROP POLICY IF EXISTS "Authenticated users can view manpower" ON public.daily_manpower;
CREATE POLICY "Users view manpower for assigned projects"
  ON public.daily_manpower FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "Supervisors and admins can insert manpower" ON public.daily_manpower;
CREATE POLICY "Supervisors and admins can insert manpower"
  ON public.daily_manpower FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
    AND public.has_project_access(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "Supervisors and admins can update manpower" ON public.daily_manpower;
CREATE POLICY "Supervisors and admins can update manpower"
  ON public.daily_manpower FOR UPDATE
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
    AND public.has_project_access(auth.uid(), project_id)
  );

-- 5. worker_attendance: same scoping
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON public.worker_attendance;
CREATE POLICY "Users view attendance for assigned projects"
  ON public.worker_attendance FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "Supervisors and admins can insert attendance" ON public.worker_attendance;
CREATE POLICY "Supervisors and admins can insert attendance"
  ON public.worker_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
    AND public.has_project_access(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "Supervisors and admins can update attendance" ON public.worker_attendance;
CREATE POLICY "Supervisors and admins can update attendance"
  ON public.worker_attendance FOR UPDATE
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
    AND public.has_project_access(auth.uid(), project_id)
  );