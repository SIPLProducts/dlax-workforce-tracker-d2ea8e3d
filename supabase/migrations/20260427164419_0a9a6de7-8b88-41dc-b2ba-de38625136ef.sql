-- 1. Add login_id column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_id text;

-- 2. Backfill login_id from email local-part, deduplicating with numeric suffix
DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, user_id, email FROM public.profiles WHERE login_id IS NULL ORDER BY created_at LOOP
    base := lower(split_part(COALESCE(r.email, r.user_id::text), '@', 1));
    IF base IS NULL OR base = '' THEN
      base := 'user' || substr(r.user_id::text, 1, 8);
    END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE login_id = candidate) LOOP
      n := n + 1;
      candidate := base || n::text;
    END LOOP;
    UPDATE public.profiles SET login_id = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 3. Enforce uniqueness and non-null
ALTER TABLE public.profiles ALTER COLUMN login_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_id_unique ON public.profiles (lower(login_id));

-- 4. Update handle_new_user trigger function to populate login_id from signup metadata or email local-part
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  desired_login text;
  base text;
  candidate text;
  n int;
BEGIN
  desired_login := lower(NULLIF(trim(NEW.raw_user_meta_data->>'login_id'), ''));
  IF desired_login IS NULL THEN
    desired_login := lower(split_part(NEW.email, '@', 1));
  END IF;
  IF desired_login IS NULL OR desired_login = '' THEN
    desired_login := 'user' || substr(NEW.id::text, 1, 8);
  END IF;

  base := desired_login;
  candidate := base;
  n := 1;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(login_id) = candidate) LOOP
    n := n + 1;
    candidate := base || n::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, email, display_name, login_id)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    candidate
  );

  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Ensure the trigger is attached (in case it wasn't)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. RPC to resolve login_id -> auth email for sign in (security definer, safe)
CREATE OR REPLACE FUNCTION public.get_email_for_login_id(_login_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(p.login_id) = lower(_login_id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_for_login_id(text) TO anon, authenticated;