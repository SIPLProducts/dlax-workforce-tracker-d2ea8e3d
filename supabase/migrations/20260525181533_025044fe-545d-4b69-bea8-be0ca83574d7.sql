-- 1. Profiles: drop broad SELECT exposing email/login_id
DROP POLICY IF EXISTS "Authed view profiles" ON public.profiles;

-- 2. project_approval_config: restrict SELECT
DROP POLICY IF EXISTS "Authed view approval config" ON public.project_approval_config;
CREATE POLICY "View approval config for accessible projects"
ON public.project_approval_config
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_approval_config'::text)
  OR has_project_access(auth.uid(), project_id)
);

-- 3. project_approval_levels: restrict SELECT
DROP POLICY IF EXISTS "Authed view approval levels" ON public.project_approval_levels;
CREATE POLICY "View approval levels for accessible projects"
ON public.project_approval_levels
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_screen_edit(auth.uid(), 'masters_approval_config'::text)
  OR has_project_access(auth.uid(), project_id)
);

-- 4. user_roles: scope "view own roles" to authenticated only
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 5. contractors: remove from realtime publication (contains contact/phone/license)
ALTER PUBLICATION supabase_realtime DROP TABLE public.contractors;
