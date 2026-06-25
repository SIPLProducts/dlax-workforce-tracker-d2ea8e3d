
CREATE TABLE public.password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_otps_email_created ON public.password_reset_otps (email, created_at DESC);

GRANT ALL ON public.password_reset_otps TO service_role;

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (server functions) may access this table.
