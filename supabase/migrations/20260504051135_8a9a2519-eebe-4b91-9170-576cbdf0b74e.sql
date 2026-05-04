
-- 1. New system roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_coordinator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_manager';

-- 2. Approval status enum
DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('draft','pending_l1','pending_l2','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. project_approval_config table
CREATE TABLE IF NOT EXISTS public.project_approval_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE,
  approval_enabled boolean NOT NULL DEFAULT false,
  l1_user_id uuid,
  l2_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_approval_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed view approval config"
  ON public.project_approval_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage approval config"
  ON public.project_approval_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_project_approval_config_updated_at
  BEFORE UPDATE ON public.project_approval_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. daily_manpower workflow columns
ALTER TABLE public.daily_manpower
  ADD COLUMN IF NOT EXISTS status public.approval_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS l1_approver_id uuid,
  ADD COLUMN IF NOT EXISTS l1_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS l1_remarks text,
  ADD COLUMN IF NOT EXISTS l2_approver_id uuid,
  ADD COLUMN IF NOT EXISTS l2_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS l2_remarks text,
  ADD COLUMN IF NOT EXISTS rejection_remarks text,
  ADD COLUMN IF NOT EXISTS rejected_by_level smallint;

-- 5. Trigger: set initial status on insert based on project config
CREATE OR REPLACE FUNCTION public.set_daily_manpower_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cfg_enabled boolean;
BEGIN
  SELECT approval_enabled INTO cfg_enabled
  FROM public.project_approval_config
  WHERE project_id = NEW.project_id;

  IF cfg_enabled IS TRUE THEN
    NEW.status := 'pending_l1';
    NEW.submitted_by := COALESCE(NEW.submitted_by, NEW.created_by, auth.uid());
    NEW.submitted_at := COALESCE(NEW.submitted_at, now());
  ELSE
    NEW.status := 'approved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_manpower_initial_status ON public.daily_manpower;
CREATE TRIGGER trg_daily_manpower_initial_status
  BEFORE INSERT ON public.daily_manpower
  FOR EACH ROW EXECUTE FUNCTION public.set_daily_manpower_initial_status();

-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.is_project_l1(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_approval_config
    WHERE project_id = _project_id AND l1_user_id = _user_id AND approval_enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_l2(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_approval_config
    WHERE project_id = _project_id AND l2_user_id = _user_id AND approval_enabled = true
  );
$$;

-- 7. Update RLS for daily_manpower to allow PC/PM updates
DROP POLICY IF EXISTS "Supervisors and admins can update manpower" ON public.daily_manpower;

CREATE POLICY "Approvers and editors can update manpower"
  ON public.daily_manpower FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
      AND has_project_access(auth.uid(), project_id)
      AND status IN ('draft','rejected','pending_l1','approved')
    )
    OR (status = 'pending_l1' AND public.is_project_l1(auth.uid(), project_id))
    OR (status = 'pending_l2' AND public.is_project_l2(auth.uid(), project_id))
  );
