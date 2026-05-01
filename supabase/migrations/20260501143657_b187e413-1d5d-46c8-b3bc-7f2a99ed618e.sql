ALTER TABLE public.daily_manpower
  ADD COLUMN IF NOT EXISTS security_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deficiency_manpower integer NOT NULL DEFAULT 0;

ALTER TABLE public.worker_categories
  ADD COLUMN IF NOT EXISTS category_group text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;