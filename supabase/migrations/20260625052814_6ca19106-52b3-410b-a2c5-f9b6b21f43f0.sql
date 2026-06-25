
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS mobile_no text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_contact_email_lower_unique
  ON public.profiles (lower(contact_email))
  WHERE contact_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_profile_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_email IS NOT NULL THEN
    NEW.contact_email := lower(trim(NEW.contact_email));
    IF NEW.contact_email = '' THEN
      NEW.contact_email := NULL;
    ELSIF length(NEW.contact_email) > 255
       OR NEW.contact_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      RAISE EXCEPTION 'Invalid contact_email format';
    END IF;
  END IF;

  IF NEW.mobile_no IS NOT NULL THEN
    NEW.mobile_no := trim(NEW.mobile_no);
    IF NEW.mobile_no = '' THEN
      NEW.mobile_no := NULL;
    ELSIF length(NEW.mobile_no) > 20
       OR NEW.mobile_no !~ '^[+0-9][0-9\s\-]{6,19}$' THEN
      RAISE EXCEPTION 'Invalid mobile_no format';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS validate_profile_contact_trigger ON public.profiles;
CREATE TRIGGER validate_profile_contact_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_contact();
