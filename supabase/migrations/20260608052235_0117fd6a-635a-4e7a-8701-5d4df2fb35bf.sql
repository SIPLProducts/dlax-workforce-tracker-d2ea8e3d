
-- Departments
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS department_code text;
CREATE SEQUENCE IF NOT EXISTS public.department_code_seq;

CREATE OR REPLACE FUNCTION public.assign_department_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.department_code IS NULL OR length(trim(NEW.department_code)) = 0 THEN
    NEW.department_code := 'DEP-' || lpad(nextval('public.department_code_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_department_code ON public.departments;
CREATE TRIGGER trg_assign_department_code
  BEFORE INSERT ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.assign_department_code();

-- Backfill departments in created_at order
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.departments
  WHERE department_code IS NULL OR length(trim(department_code)) = 0
)
UPDATE public.departments d
SET department_code = 'DEP-' || lpad(o.rn::text, 3, '0')
FROM ordered o WHERE o.id = d.id;

-- Advance sequence past current max numeric suffix
SELECT setval('public.department_code_seq',
  GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(department_code, '\D', '', 'g'), '')::int)
                        FROM public.departments), 0)));

ALTER TABLE public.departments
  ADD CONSTRAINT departments_department_code_key UNIQUE (department_code);

-- Worker Categories
ALTER TABLE public.worker_categories ADD COLUMN IF NOT EXISTS category_code text;
CREATE SEQUENCE IF NOT EXISTS public.category_code_seq;

CREATE OR REPLACE FUNCTION public.assign_category_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.category_code IS NULL OR length(trim(NEW.category_code)) = 0 THEN
    NEW.category_code := 'CAT-' || lpad(nextval('public.category_code_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_category_code ON public.worker_categories;
CREATE TRIGGER trg_assign_category_code
  BEFORE INSERT ON public.worker_categories
  FOR EACH ROW EXECUTE FUNCTION public.assign_category_code();

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.worker_categories
  WHERE category_code IS NULL OR length(trim(category_code)) = 0
)
UPDATE public.worker_categories c
SET category_code = 'CAT-' || lpad(o.rn::text, 3, '0')
FROM ordered o WHERE o.id = c.id;

SELECT setval('public.category_code_seq',
  GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(category_code, '\D', '', 'g'), '')::int)
                        FROM public.worker_categories), 0)));

ALTER TABLE public.worker_categories
  ADD CONSTRAINT worker_categories_category_code_key UNIQUE (category_code);
