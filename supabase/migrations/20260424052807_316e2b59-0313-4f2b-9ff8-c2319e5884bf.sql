ALTER TABLE public.contractors ADD COLUMN contractor_code text;
CREATE UNIQUE INDEX contractors_contractor_code_unique ON public.contractors (contractor_code) WHERE contractor_code IS NOT NULL;