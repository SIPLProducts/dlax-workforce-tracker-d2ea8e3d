-- 1. Helper: check whether a user's effective screen permission is 'edit'
create or replace function public.has_screen_edit(_user_id uuid, _screen_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_screen_permission(_user_id, _screen_key) = 'edit'::permission_level
$$;

-- 2. daily_manpower: allow writes also from users whose custom role grants daily_entry edit
DROP POLICY IF EXISTS "Supervisors and admins can insert manpower" ON public.daily_manpower;
CREATE POLICY "Allowed users can insert manpower"
ON public.daily_manpower
FOR INSERT
TO authenticated
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_screen_edit(auth.uid(), 'daily_entry')
  )
  AND public.has_project_access(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Approvers and editors can update manpower" ON public.daily_manpower;
CREATE POLICY "Approvers and editors can update manpower"
ON public.daily_manpower
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'supervisor'::app_role)
      OR public.has_screen_edit(auth.uid(), 'daily_entry')
    )
    AND public.has_project_access(auth.uid(), project_id)
    AND status = ANY (ARRAY['draft'::approval_status, 'rejected'::approval_status, 'pending_l1'::approval_status, 'approved'::approval_status])
  )
  OR (status = 'pending_l1'::approval_status AND is_project_l1(auth.uid(), project_id))
  OR (status = 'pending_l2'::approval_status AND is_project_l2(auth.uid(), project_id))
);

-- 3. worker_attendance: same treatment
DROP POLICY IF EXISTS "Supervisors and admins can insert attendance" ON public.worker_attendance;
CREATE POLICY "Allowed users can insert attendance"
ON public.worker_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_screen_edit(auth.uid(), 'daily_entry')
  )
  AND public.has_project_access(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Supervisors and admins can update attendance" ON public.worker_attendance;
CREATE POLICY "Allowed users can update attendance"
ON public.worker_attendance
FOR UPDATE
TO authenticated
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_screen_edit(auth.uid(), 'daily_entry')
  )
  AND public.has_project_access(auth.uid(), project_id)
);

-- 4. One-off cleanup: remove the auto-granted 'supervisor' system role from users
--    who now hold a custom role. Their custom role becomes the source of truth.
DELETE FROM public.user_roles
WHERE role = 'supervisor'
  AND user_id IN (SELECT user_id FROM public.user_custom_roles)
  AND user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');