
-- 1. project_approval_levels
CREATE TABLE public.project_approval_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  level_no smallint NOT NULL CHECK (level_no >= 1),
  approver_user_id uuid NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, level_no)
);
ALTER TABLE public.project_approval_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed view approval levels"
  ON public.project_approval_levels FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins or approval-mgr manage approval levels"
  ON public.project_approval_levels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_screen_edit(auth.uid(), 'masters_approval_config'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_screen_edit(auth.uid(), 'masters_approval_config'::text));

CREATE TRIGGER trg_pal_updated BEFORE UPDATE ON public.project_approval_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. daily_manpower_sheets new columns
ALTER TABLE public.daily_manpower_sheets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS current_level smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_levels smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_remarks text;

-- 3. sheet_approval_history (audit log)
CREATE TABLE public.sheet_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.daily_manpower_sheets(id) ON DELETE CASCADE,
  level_no smallint NOT NULL,
  approver_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approve','reject')),
  remarks text,
  action_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sheet_approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View history for accessible sheets"
  ON public.sheet_approval_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.daily_manpower_sheets s
                 WHERE s.id = sheet_id AND has_project_access(auth.uid(), s.project_id)));

-- INSERT only via SECURITY DEFINER funcs; no policy for INSERT/UPDATE/DELETE

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.is_project_level_approver(_user_id uuid, _project_id uuid, _level smallint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_approval_levels
    WHERE project_id = _project_id AND level_no = _level AND approver_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_sheet_approver(_user_id uuid, _sheet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_manpower_sheets s
    JOIN public.project_approval_levels lv
      ON lv.project_id = s.project_id AND lv.level_no = s.current_level
    WHERE s.id = _sheet_id
      AND s.status = 'pending'
      AND lv.approver_user_id = _user_id
  );
$$;

-- 5. RPCs
CREATE OR REPLACE FUNCTION public.submit_sheet(_sheet_id uuid)
RETURNS public.daily_manpower_sheets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sheet public.daily_manpower_sheets;
  _total smallint;
  _cfg_enabled boolean;
BEGIN
  SELECT * INTO _sheet FROM public.daily_manpower_sheets WHERE id = _sheet_id;
  IF _sheet.id IS NULL THEN RAISE EXCEPTION 'Sheet not found'; END IF;

  -- Caller must have edit + project access
  IF NOT (has_role(auth.uid(), 'admin'::app_role)
          OR (has_screen_edit(auth.uid(), 'daily_entry') AND has_project_access(auth.uid(), _sheet.project_id))) THEN
    RAISE EXCEPTION 'Not authorized to submit this sheet';
  END IF;

  IF _sheet.status NOT IN ('draft','rejected') THEN
    RAISE EXCEPTION 'Sheet is not in a submittable state (current: %)', _sheet.status;
  END IF;

  SELECT approval_enabled INTO _cfg_enabled FROM public.project_approval_config WHERE project_id = _sheet.project_id;
  SELECT count(*)::smallint INTO _total FROM public.project_approval_levels WHERE project_id = _sheet.project_id;

  IF COALESCE(_cfg_enabled,false) = false OR _total = 0 THEN
    -- No approval needed
    UPDATE public.daily_manpower_sheets
       SET status = 'approved', current_level = 0, total_levels = 0,
           submitted_by = auth.uid(), submitted_at = now(),
           rejection_remarks = NULL
     WHERE id = _sheet_id RETURNING * INTO _sheet;
    UPDATE public.daily_manpower SET status = 'approved' WHERE sheet_id = _sheet_id;
    RETURN _sheet;
  END IF;

  UPDATE public.daily_manpower_sheets
     SET status = 'pending', current_level = 1, total_levels = _total,
         submitted_by = auth.uid(), submitted_at = now(),
         rejection_remarks = NULL
   WHERE id = _sheet_id RETURNING * INTO _sheet;
  -- Mirror to per-row status (generic pending marker)
  UPDATE public.daily_manpower SET status = 'pending_l1', submitted_by = auth.uid(), submitted_at = now()
   WHERE sheet_id = _sheet_id;

  RETURN _sheet;
END $$;

CREATE OR REPLACE FUNCTION public.approve_sheet(_sheet_id uuid, _remarks text DEFAULT NULL)
RETURNS public.daily_manpower_sheets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sheet public.daily_manpower_sheets;
BEGIN
  SELECT * INTO _sheet FROM public.daily_manpower_sheets WHERE id = _sheet_id;
  IF _sheet.id IS NULL THEN RAISE EXCEPTION 'Sheet not found'; END IF;
  IF _sheet.status <> 'pending' THEN RAISE EXCEPTION 'Sheet is not pending approval'; END IF;
  IF NOT is_current_sheet_approver(auth.uid(), _sheet_id) THEN
    RAISE EXCEPTION 'Only the approver assigned to level % can approve this sheet', _sheet.current_level;
  END IF;

  INSERT INTO public.sheet_approval_history (sheet_id, level_no, approver_user_id, action, remarks)
    VALUES (_sheet_id, _sheet.current_level, auth.uid(), 'approve', _remarks);

  IF _sheet.current_level >= _sheet.total_levels THEN
    UPDATE public.daily_manpower_sheets
       SET status = 'approved', current_level = _sheet.total_levels
     WHERE id = _sheet_id RETURNING * INTO _sheet;
    UPDATE public.daily_manpower SET status = 'approved' WHERE sheet_id = _sheet_id;
  ELSE
    UPDATE public.daily_manpower_sheets
       SET current_level = _sheet.current_level + 1
     WHERE id = _sheet_id RETURNING * INTO _sheet;
    -- per-row status stays 'pending_l1' as a generic pending marker
  END IF;
  RETURN _sheet;
END $$;

CREATE OR REPLACE FUNCTION public.reject_sheet(_sheet_id uuid, _remarks text)
RETURNS public.daily_manpower_sheets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sheet public.daily_manpower_sheets;
BEGIN
  IF _remarks IS NULL OR length(trim(_remarks)) = 0 THEN
    RAISE EXCEPTION 'Rejection remarks are required';
  END IF;
  SELECT * INTO _sheet FROM public.daily_manpower_sheets WHERE id = _sheet_id;
  IF _sheet.id IS NULL THEN RAISE EXCEPTION 'Sheet not found'; END IF;
  IF _sheet.status <> 'pending' THEN RAISE EXCEPTION 'Sheet is not pending approval'; END IF;
  IF NOT is_current_sheet_approver(auth.uid(), _sheet_id) THEN
    RAISE EXCEPTION 'Only the approver assigned to level % can reject this sheet', _sheet.current_level;
  END IF;

  INSERT INTO public.sheet_approval_history (sheet_id, level_no, approver_user_id, action, remarks)
    VALUES (_sheet_id, _sheet.current_level, auth.uid(), 'reject', _remarks);

  UPDATE public.daily_manpower_sheets
     SET status = 'rejected', current_level = 0, rejection_remarks = _remarks
   WHERE id = _sheet_id RETURNING * INTO _sheet;
  UPDATE public.daily_manpower SET status = 'rejected', rejection_remarks = _remarks WHERE sheet_id = _sheet_id;
  RETURN _sheet;
END $$;

-- 6. Backfill existing L1/L2 config -> levels
INSERT INTO public.project_approval_levels (project_id, level_no, approver_user_id, label)
SELECT project_id, 1::smallint, l1_user_id, 'Project Coordinator'
FROM public.project_approval_config
WHERE approval_enabled = true AND l1_user_id IS NOT NULL
ON CONFLICT (project_id, level_no) DO NOTHING;

INSERT INTO public.project_approval_levels (project_id, level_no, approver_user_id, label)
SELECT project_id, 2::smallint, l2_user_id, 'Project Manager'
FROM public.project_approval_config
WHERE approval_enabled = true AND l2_user_id IS NOT NULL
ON CONFLICT (project_id, level_no) DO NOTHING;

-- 7. Backfill sheet status from existing per-row statuses
UPDATE public.daily_manpower_sheets s
   SET status = CASE
     WHEN agg.rejected_n > 0 THEN 'rejected'
     WHEN agg.pending_n > 0 THEN 'pending'
     WHEN agg.approved_n > 0 AND agg.total_n = agg.approved_n THEN 'approved'
     ELSE 'draft'
   END,
   current_level = CASE
     WHEN agg.pending_l1_n > 0 THEN 1
     WHEN agg.pending_l2_n > 0 THEN 2
     ELSE 0
   END,
   total_levels = COALESCE((SELECT count(*) FROM public.project_approval_levels lv WHERE lv.project_id = s.project_id), 0)
FROM (
  SELECT sheet_id,
         count(*) AS total_n,
         count(*) FILTER (WHERE status='approved') AS approved_n,
         count(*) FILTER (WHERE status='rejected') AS rejected_n,
         count(*) FILTER (WHERE status IN ('pending_l1','pending_l2')) AS pending_n,
         count(*) FILTER (WHERE status='pending_l1') AS pending_l1_n,
         count(*) FILTER (WHERE status='pending_l2') AS pending_l2_n
  FROM public.daily_manpower
  WHERE sheet_id IS NOT NULL
  GROUP BY sheet_id
) agg
WHERE s.id = agg.sheet_id;

-- 8. RLS on daily_manpower_sheets: tighten UPDATE so editors can't change status when locked
DROP POLICY IF EXISTS "Daily-entry editors manage sheets" ON public.daily_manpower_sheets;

CREATE POLICY "Editors insert sheets"
  ON public.daily_manpower_sheets FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR ((has_role(auth.uid(),'supervisor'::app_role) OR has_screen_edit(auth.uid(),'daily_entry'))
         AND has_project_access(auth.uid(), project_id))
  );

CREATE POLICY "Editors update draft/rejected sheets"
  ON public.daily_manpower_sheets FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR ((has_role(auth.uid(),'supervisor'::app_role) OR has_screen_edit(auth.uid(),'daily_entry'))
         AND has_project_access(auth.uid(), project_id)
         AND status IN ('draft','rejected'))
  );

CREATE POLICY "Admins delete sheets"
  ON public.daily_manpower_sheets FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));
