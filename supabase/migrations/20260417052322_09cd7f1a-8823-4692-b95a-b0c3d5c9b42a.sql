
-- Custom roles table
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Permission level enum
CREATE TYPE public.permission_level AS ENUM ('none', 'view', 'edit');

-- Screen permissions per role
CREATE TABLE public.role_screen_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  screen_key text NOT NULL,
  permission permission_level NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, screen_key)
);

-- Assign custom roles to users
CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_screen_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- Helper: get a user's effective permission for a screen
CREATE OR REPLACE FUNCTION public.get_screen_permission(_user_id uuid, _screen_key text)
RETURNS permission_level
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT MAX(rsp.permission)
     FROM public.user_custom_roles ucr
     JOIN public.role_screen_permissions rsp ON rsp.role_id = ucr.role_id
     WHERE ucr.user_id = _user_id AND rsp.screen_key = _screen_key),
    CASE WHEN public.has_role(_user_id, 'admin'::app_role) THEN 'edit'::permission_level
         ELSE 'none'::permission_level END
  )
$$;

-- RLS policies — admins manage, everyone authed can read their own permissions
CREATE POLICY "Admins manage custom_roles" ON public.custom_roles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authed view custom_roles" ON public.custom_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage role_screen_permissions" ON public.role_screen_permissions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authed view role_screen_permissions" ON public.role_screen_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage user_custom_roles" ON public.user_custom_roles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own custom roles" ON public.user_custom_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_custom_roles_updated BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_role_screen_permissions_updated BEFORE UPDATE ON public.role_screen_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
