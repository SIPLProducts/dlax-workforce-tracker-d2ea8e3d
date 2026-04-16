
-- Add project code and division
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS division TEXT;

-- Add contractor contact details
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS work_place TEXT;

-- Add NMR and security tracking to daily_manpower
ALTER TABLE public.daily_manpower ADD COLUMN IF NOT EXISTS nmr_mason INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_manpower ADD COLUMN IF NOT EXISTS nmr_male_helpers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_manpower ADD COLUMN IF NOT EXISTS nmr_female_helpers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_manpower ADD COLUMN IF NOT EXISTS security_count INTEGER NOT NULL DEFAULT 0;
