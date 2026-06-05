## Diagnosis

`dlax-rest` (PostgREST image) is built `FROM scratch` — it has no `printenv`, no `/bin/sh`, so `docker exec dlax-rest printenv PGRST_JWT_SECRET` fails with "OCI runtime exec failed". The stderr from docker was captured into `$REST_JWT`, producing the bogus `[OCI runt...]` prefix and triggering the false mismatch / die.

Both containers actually share the same `${JWT_SECRET}` from `supabase-stack/.env` (compose substitutes it at start), so the secret is fine — only the probe is wrong.

## Plan

Update the JWT consistency probe in `install.sh` to read env vars via `docker inspect` (which reads the container's static env config and works for any image, including scratch-based ones) instead of `docker exec printenv`.

- Replace `docker exec dlax-auth printenv GOTRUE_JWT_SECRET` with:
  `docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' dlax-auth | sed -n 's/^GOTRUE_JWT_SECRET=//p'`
- Replace `docker exec dlax-rest printenv PGRST_JWT_SECRET` with:
  `docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' dlax-rest | sed -n 's/^PGRST_JWT_SECRET=//p'`
- Apply the same change in the retry branch after `docker compose up -d --force-recreate auth rest`.
- Keep everything else (prefix logging, restart fallback, curl self-test, hard fail on real mismatch).

## Scope

- `install.sh` only — probe correctness fix.
- No app code, no database, no policy changes.

## Expected result

The probe reports real secret values for both containers; if they match `.env` (the normal case), it prints "JWT_SECRET consistent" and proceeds to the curl self-test. The installer no longer dies on a false-positive caused by the scratch-image shell limitation.