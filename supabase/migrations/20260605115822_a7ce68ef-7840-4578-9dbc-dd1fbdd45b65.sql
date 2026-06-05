GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION auth.uid()  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt()  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;