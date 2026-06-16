CREATE TYPE public.contract_type AS ENUM ('item_rate', 'nmr');
ALTER TABLE public.contractors ADD COLUMN contract_type public.contract_type NOT NULL DEFAULT 'item_rate';
UPDATE public.contractors SET contract_type = 'nmr' WHERE nature_of_work ILIKE '%NMR%';