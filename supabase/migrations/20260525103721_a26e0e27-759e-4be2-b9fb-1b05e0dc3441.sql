DROP POLICY IF EXISTS "Admins can delete manpower" ON public.daily_manpower;

CREATE POLICY "Editors can delete editable manpower"
ON public.daily_manpower
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'supervisor'::app_role) OR has_screen_edit(auth.uid(), 'daily_entry'::text))
    AND has_project_access(auth.uid(), project_id)
    AND status = ANY (ARRAY['draft'::approval_status, 'rejected'::approval_status])
  )
);