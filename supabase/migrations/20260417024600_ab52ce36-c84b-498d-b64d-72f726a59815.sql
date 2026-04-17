ALTER TABLE public.daily_manpower
  DROP COLUMN IF EXISTS hours_worked,
  DROP COLUMN IF EXISTS overtime_hours,
  DROP COLUMN IF EXISTS nmr_mason,
  DROP COLUMN IF EXISTS nmr_male_helpers,
  DROP COLUMN IF EXISTS nmr_female_helpers,
  DROP COLUMN IF EXISTS security_count;