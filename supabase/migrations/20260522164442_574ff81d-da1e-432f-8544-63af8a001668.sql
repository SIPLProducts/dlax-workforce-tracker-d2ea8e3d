
-- custom_roles
DROP POLICY IF EXISTS "Admins manage custom_roles" ON public.custom_roles;
CREATE POLICY "Admins or user-mgr manage custom_roles"
ON public.custom_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'));

-- role_screen_permissions
DROP POLICY IF EXISTS "Admins manage role_screen_permissions" ON public.role_screen_permissions;
CREATE POLICY "Admins or user-mgr manage role_screen_permissions"
ON public.role_screen_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'));

-- user_custom_roles
DROP POLICY IF EXISTS "Admins manage user_custom_roles" ON public.user_custom_roles;
CREATE POLICY "Admins or user-mgr manage user_custom_roles"
ON public.user_custom_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_screen_edit(auth.uid(), 'user_management'));
