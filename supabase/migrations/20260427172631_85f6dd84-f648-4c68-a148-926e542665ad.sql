INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ucr.user_id, 'supervisor'::app_role
FROM public.user_custom_roles ucr
JOIN public.role_screen_permissions rsp
  ON rsp.role_id = ucr.role_id
 AND rsp.screen_key = 'daily_entry'
 AND rsp.permission = 'edit'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = ucr.user_id
    AND ur.role IN ('admin'::app_role, 'supervisor'::app_role)
);