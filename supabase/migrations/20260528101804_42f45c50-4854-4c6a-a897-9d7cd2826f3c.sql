GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_categories TO authenticated;
GRANT ALL ON public.worker_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_categories TO authenticated;
GRANT ALL ON public.department_categories TO service_role;