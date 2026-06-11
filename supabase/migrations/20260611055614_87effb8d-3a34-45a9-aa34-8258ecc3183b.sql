INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ucr.user_id, 'admin'::app_role
FROM public.user_custom_roles ucr
JOIN public.custom_roles cr ON cr.id = ucr.role_id
WHERE lower(cr.name) = 'administrator'
ON CONFLICT (user_id, role) DO NOTHING;