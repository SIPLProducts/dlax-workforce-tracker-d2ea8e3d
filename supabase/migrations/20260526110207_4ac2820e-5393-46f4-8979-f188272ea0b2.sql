DROP POLICY IF EXISTS "Editors can delete editable manpower" ON public.daily_manpower;
DROP POLICY IF EXISTS "Approvers and editors can update manpower" ON public.daily_manpower;

CREATE POLICY "Editors can delete editable manpower"
ON public.daily_manpower FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'supervisor'::app_role) OR has_screen_edit(auth.uid(), 'daily_entry'::text))
    AND has_project_access(auth.uid(), project_id)
    AND (
      sheet_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.daily_manpower_sheets s
        WHERE s.id = daily_manpower.sheet_id
          AND s.status IN ('draft','rejected')
      )
    )
  )
);

CREATE POLICY "Approvers and editors can update manpower"
ON public.daily_manpower FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'supervisor'::app_role) OR has_screen_edit(auth.uid(), 'daily_entry'::text))
    AND has_project_access(auth.uid(), project_id)
    AND (
      sheet_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.daily_manpower_sheets s
        WHERE s.id = daily_manpower.sheet_id
          AND s.status IN ('draft','rejected')
      )
    )
  )
  OR (status = 'pending_l1'::approval_status AND is_project_l1(auth.uid(), project_id))
  OR (status = 'pending_l2'::approval_status AND is_project_l2(auth.uid(), project_id))
);

UPDATE public.daily_manpower dm
SET status = (CASE s.status
                WHEN 'draft' THEN 'draft'
                WHEN 'rejected' THEN 'rejected'
                WHEN 'approved' THEN 'approved'
                WHEN 'pending' THEN 'pending_l1'
              END)::approval_status
FROM public.daily_manpower_sheets s
WHERE dm.sheet_id = s.id
  AND dm.status::text <> (CASE s.status
                            WHEN 'draft' THEN 'draft'
                            WHEN 'rejected' THEN 'rejected'
                            WHEN 'approved' THEN 'approved'
                            WHEN 'pending' THEN 'pending_l1'
                          END);