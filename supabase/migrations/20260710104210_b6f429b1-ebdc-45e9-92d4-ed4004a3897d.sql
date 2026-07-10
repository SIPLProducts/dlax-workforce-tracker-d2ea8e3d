REVOKE ALL ON FUNCTION public.has_project_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_project_access(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';