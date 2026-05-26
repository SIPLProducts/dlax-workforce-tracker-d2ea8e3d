CREATE OR REPLACE FUNCTION public.get_user_display_info(_user_ids uuid[])
RETURNS TABLE(user_id uuid, login_id text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, login_id, display_name
  FROM public.profiles
  WHERE user_id = ANY(_user_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_display_info(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_display_info(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_display_info(uuid[]) TO authenticated;