
-- 1. Sequence + sheets table
CREATE SEQUENCE IF NOT EXISTS public.daily_sheet_seq START 1;

CREATE TABLE IF NOT EXISTS public.daily_manpower_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  entry_date date NOT NULL,
  sheet_code text NOT NULL UNIQUE DEFAULT ('DE-' || lpad(nextval('public.daily_sheet_seq')::text, 6, '0')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, entry_date)
);

ALTER TABLE public.daily_manpower_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View sheets for assigned projects"
ON public.daily_manpower_sheets FOR SELECT TO authenticated
USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Daily-entry editors manage sheets"
ON public.daily_manpower_sheets FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((has_role(auth.uid(), 'supervisor'::app_role) OR has_screen_edit(auth.uid(), 'daily_entry'))
      AND has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((has_role(auth.uid(), 'supervisor'::app_role) OR has_screen_edit(auth.uid(), 'daily_entry'))
      AND has_project_access(auth.uid(), project_id))
);

CREATE TRIGGER trg_sheets_updated_at
BEFORE UPDATE ON public.daily_manpower_sheets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Link daily_manpower → sheet
ALTER TABLE public.daily_manpower
  ADD COLUMN IF NOT EXISTS sheet_id uuid REFERENCES public.daily_manpower_sheets(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_daily_manpower_sheet_id ON public.daily_manpower(sheet_id);

-- 3. Trigger to auto-assign sheet on insert
CREATE OR REPLACE FUNCTION public.assign_daily_sheet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid;
BEGIN
  IF NEW.sheet_id IS NULL THEN
    SELECT id INTO _sid FROM public.daily_manpower_sheets
      WHERE project_id = NEW.project_id AND entry_date = NEW.entry_date;
    IF _sid IS NULL THEN
      INSERT INTO public.daily_manpower_sheets (project_id, entry_date)
        VALUES (NEW.project_id, NEW.entry_date) RETURNING id INTO _sid;
    END IF;
    NEW.sheet_id := _sid;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_daily_sheet ON public.daily_manpower;
CREATE TRIGGER trg_assign_daily_sheet
BEFORE INSERT ON public.daily_manpower
FOR EACH ROW EXECUTE FUNCTION public.assign_daily_sheet();

-- 4. Backfill sheets for existing data
INSERT INTO public.daily_manpower_sheets (project_id, entry_date)
SELECT DISTINCT project_id, entry_date FROM public.daily_manpower
WHERE sheet_id IS NULL
ON CONFLICT (project_id, entry_date) DO NOTHING;

UPDATE public.daily_manpower dm
SET sheet_id = s.id
FROM public.daily_manpower_sheets s
WHERE dm.sheet_id IS NULL
  AND dm.project_id = s.project_id
  AND dm.entry_date = s.entry_date;

-- 5. Change initial status trigger: default to 'draft' (not auto pending_l1).
--    "Send to Approval" button will explicitly move rows to pending_l1.
CREATE OR REPLACE FUNCTION public.set_daily_manpower_initial_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  cfg_enabled boolean;
BEGIN
  SELECT approval_enabled INTO cfg_enabled
  FROM public.project_approval_config
  WHERE project_id = NEW.project_id;

  IF cfg_enabled IS TRUE THEN
    NEW.status := 'draft';
    NEW.submitted_by := COALESCE(NEW.submitted_by, NEW.created_by, auth.uid());
  ELSE
    NEW.status := 'approved';
  END IF;
  RETURN NEW;
END $$;

-- 6. Tighten UPDATE policy: editors cannot modify rows whose status is 'approved'
--    (approvers and admin can still update for status transitions / overrides).
DROP POLICY IF EXISTS "Approvers and editors can update manpower" ON public.daily_manpower;

CREATE POLICY "Approvers and editors can update manpower"
ON public.daily_manpower FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'supervisor'::app_role) OR has_screen_edit(auth.uid(), 'daily_entry'))
    AND has_project_access(auth.uid(), project_id)
    AND status = ANY (ARRAY['draft'::approval_status, 'rejected'::approval_status])
  )
  OR (status = 'pending_l1'::approval_status AND is_project_l1(auth.uid(), project_id))
  OR (status = 'pending_l2'::approval_status AND is_project_l2(auth.uid(), project_id))
);
