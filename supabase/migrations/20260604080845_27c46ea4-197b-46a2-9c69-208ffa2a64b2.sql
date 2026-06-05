-- Sweep orphans so the FKs can be added on any environment.
DELETE FROM public.project_contractors pc
 WHERE NOT EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = pc.contractor_id);

DELETE FROM public.project_contractors pc
 WHERE NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = pc.project_id);

ALTER TABLE public.project_contractors
  ADD CONSTRAINT project_contractors_contractor_id_fkey
  FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;

ALTER TABLE public.project_contractors
  ADD CONSTRAINT project_contractors_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
