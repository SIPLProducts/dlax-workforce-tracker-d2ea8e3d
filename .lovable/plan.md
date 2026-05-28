## Root cause

The verification step fails with `{"message":"Invalid authentication credentials"}` because **Kong is loading `kong.yml` with the literal string `${SUPABASE_ANON_KEY}` as the registered API key** — the official `kong:2.8.1` image does NOT perform env-var substitution inside the declarative config file. Supabase's upstream stack works around this by pre-processing `kong.yml`; our installer doesn't.

So:
- `mint_jwt anon $JWT` produces a real JWT and we send it as `apikey: <jwt>` to `/rest/v1/rpc/...`
- Kong compares it against its registered consumer key, which is the unsubstituted text `${SUPABASE_ANON_KEY}`
- Mismatch → `401 Invalid authentication credentials` (this error is from Kong's key-auth plugin, not PostgREST)

This is also why the browser sees the same error when logging in.

## Plan (install.sh only — no app code change)

1. **Convert `supabase-stack/volumes/api/kong.yml` into a template** consumed by the installer. Rename to `kong.yml.template` (kept in repo), keep the existing `${SUPABASE_ANON_KEY}` / `${SUPABASE_SERVICE_KEY}` placeholders.

2. **Render the template in `install.sh`** right after `$ANON` / `$SRK` are minted and before `docker compose up -d`:
   ```bash
   SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_KEY="$SRK" \
     envsubst '${SUPABASE_ANON_KEY} ${SUPABASE_SERVICE_KEY}' \
     < "$SUPA/volumes/api/kong.yml.template" \
     > "$SUPA/volumes/api/kong.yml"
   ```
   Ensure `envsubst` (from `gettext-base`) is installed; add an apt install step alongside the other prerequisites.

3. **Remove the now-misleading `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` env vars from the `kong` service** in `supabase-stack/docker-compose.yml` (they were never honored by Kong, and the rendered file no longer needs them).

4. **Add the rendered `kong.yml` to the wipe step** so a stale render from a previous install can't be reused with a new JWT secret.

5. **Re-run instructions** stay the same:
   ```bash
   sudo SERVER_IP=15.206.37.230 ADMIN_LOGIN_ID=admin ADMIN_PASSWORD='admin123456' ./install.sh
   ```
   After this change the installer's two verifications (`get_email_for_login_id` RPC + `/auth/v1/token` password sign-in) will pass and browser login with `admin / admin123456` will work.

## Why this matches the symptom

- The DB seeding succeeded (profile + role inserted via direct psql).
- Only HTTP calls through Kong failed — exactly what an unsubstituted Kong API key would break.
- The same Kong key-auth gate also fronts `/rest/v1/rpc/get_email_for_login_id` that the browser hits on login, so fixing it fixes both the installer check and the in-app login.
