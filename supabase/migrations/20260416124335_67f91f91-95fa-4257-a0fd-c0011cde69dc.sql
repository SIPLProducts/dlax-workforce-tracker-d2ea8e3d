
CREATE TABLE public.department_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.worker_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (department_id, category_id)
);

ALTER TABLE public.department_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view department_categories"
ON public.department_categories FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage department_categories"
ON public.department_categories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
