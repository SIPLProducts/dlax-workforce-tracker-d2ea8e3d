## Diagnosis

`PGRST301 JWSInvalidSignature` means PostgREST rejected the JWT because the signature does not match its configured `PGRST_JWT_SECRET`. In this stack both `gotrue` and `postgrest` read `${JWT_SECRET}` from `supabase-stack/.env`, so a mismatch can come from only a few sources:

1. **Stale browser session (most likely)** — A previous `install.sh` run minted a different `JWT_SECRET`. The Supabase JS client persisted that old session token in `localStorage`. On the new install the secret changed, so any request carrying the old bearer token fails with `JWSInvalidSignature`. The "login successful" alert may even be coming from a code path that swallows the error.
2. **Running containers out of sync with `.env`** — If `docker compose up -d` was run before `.env` was rewritten, or only some services were restarted, gotrue and postgrest can end up holding different `JWT_SECRET` values.
3. **`.env` race during build** — App `.env` written with the new `ANON`, but supabase stack still serving old secret.

## Plan

1. **Add a runtime JWT consistency probe to `install.sh`** (after stack is up, before grants check):
   - Read `JWT_SECRET` env from inside the `auth` (gotrue) container and the `rest` (postgrest) container.
   - Compare both to the value in `supabase-stack/.env`.
   - If any differ, restart the affected service(s) and re-check. If still mismatched, `die` with a clear message.
   - Log a short prefix (first 8 chars) of each so the operator can visually confirm without leaking the full secret.

2. **Add a self-test that signs a token and calls PostgREST**:
   - Mint a fresh test JWT in-shell using the `JWT_SECRET` from `.env` (reusing the existing `mint_jwt` helper).
   - `curl` `http://127.0.0.1:$SUPABASE_API_PORT/rest/v1/user_roles?select=id&limit=1` with `apikey: $ANON` and `Authorization: Bearer <test_jwt>`.
   - Expect HTTP 200 (empty array is fine). On 401 with `JWSInvalidSignature`, surface a precise error pointing at the secret mismatch.

3. **Help the deployed-app user clear the stale session** (no app code logic changes):
   - On the login page, when a `PGRST301 / JWSInvalidSignature` is detected during the post-login bootstrap query, call `supabase.auth.signOut()` and `localStorage.clear()` for Supabase keys, then prompt the user to sign in again. This converts the dead-end "alert success then bounce" into a clean recovery.

4. **Document the recovery for the operator** in the installer output:
   - After successful verification, print a one-line note: "If browsers show JWSInvalidSignature, the user has a stale session from a prior install — clear site storage or use a private window."

## Scope

- Backend installer: `install.sh` only (diagnostic probe + self-test + operator hint).
- Frontend: a minimal, defensive sign-out on `PGRST301` during login bootstrap — no business logic or RLS changes.
- No database migrations, no policy changes, no key rotation.

## Expected result

After re-running `install.sh`, the installer fails fast with a precise message if `JWT_SECRET` is inconsistent across services, and a curl probe confirms PostgREST accepts a token signed by the current secret. End users who hit the error in the browser get auto-signed-out and prompted to log in again instead of bouncing silently.