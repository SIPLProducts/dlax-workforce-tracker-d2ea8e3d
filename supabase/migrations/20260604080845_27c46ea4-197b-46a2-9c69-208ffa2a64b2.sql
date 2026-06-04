
ALTER TABLE public.project_contractors
  ADD CONSTRAINT project_contractors_contractor_id_fkey
  FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;

ALTER TABLE public.project_contractors
  ADD CONSTRAINT project_contractors_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

UPDATE public.project_contractors
   SET project_id = '45eaa690-13ad-4fa7-934e-58196f2ab4e3'
 WHERE contractor_id = 'd81269c7-c06f-4941-84f0-e0c63c59eb27';

INSERT INTO public.project_contractors (project_id, contractor_id)
VALUES ('45eaa690-13ad-4fa7-934e-58196f2ab4e3', '3b6ee1ca-b0e4-43f5-bb40-a444165f5679')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
