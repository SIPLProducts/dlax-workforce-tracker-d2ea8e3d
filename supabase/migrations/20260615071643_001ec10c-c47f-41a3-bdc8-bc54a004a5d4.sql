
CREATE TABLE public.email_config (
  id text PRIMARY KEY DEFAULT 'default',
  enabled boolean NOT NULL DEFAULT false,
  smtp_host text NOT NULL DEFAULT '',
  smtp_port int NOT NULL DEFAULT 587,
  encryption text NOT NULL DEFAULT 'tls' CHECK (encryption IN ('none','ssl','tls')),
  username text NOT NULL DEFAULT '',
  app_password text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  cc_recipients text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_config TO authenticated;
GRANT ALL ON public.email_config TO service_role;

ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email config"
  ON public.email_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.email_config_public
WITH (security_invoker = true) AS
SELECT id, enabled, smtp_host, smtp_port, encryption, username,
       (length(app_password) > 0) AS has_password,
       from_email, from_name, cc_recipients, updated_at, updated_by
FROM public.email_config;

GRANT SELECT ON public.email_config_public TO authenticated;

CREATE TRIGGER trg_email_config_updated_at
  BEFORE UPDATE ON public.email_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
