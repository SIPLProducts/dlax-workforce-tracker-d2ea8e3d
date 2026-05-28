## What `JWSError JWSInvalidSignature` means

PostgREST received a JWT (your access token) but the HMAC signature did not verify against the `JWT_SECRET` that PostgREST is currently running with. Login itself "succeeded" because:
- either GoTrue (auth) signed the token with a **different** secret than PostgREST is checking against, **or**
- the browser is replaying an **old** access token from a previous install whose secret has been rotated.

`install.sh` generates a brand-new random `JWT_SECRET` every run (line 152) and rebuilds `ANON_KEY` / `SERVICE_ROLE_KEY` from it. So any token issued by a previous install is permanently invalid after re-running the script.

## Plan

### Step 1 — Diagnose (read-only, run on the server)

```bash
SUPA=/home/ubuntu/dlax-workforce-tracker-d2ea8e3d-main/supabase-stack

# A) Secret in the generated .env (source of truth for this install)
sudo grep -E '^(JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY)=' $SUPA/.env

# B) Secret actually loaded into each running container
for c in dlax-auth dlax-rest dlax-kong dlax-storage dlax-realtime; do
  echo "=== $c ==="
  docker exec "$c" sh -c 'echo JWT=${PGRST_JWT_SECRET:-${GOTRUE_JWT_SECRET:-$JWT_SECRET}}' 2>/dev/null
done

# C) Anon key baked into the served JS bundle
sudo grep -oE 'eyJhbGciOi[A-Za-z0-9_.-]+' \
  /var/www/dlax-frontend/assets/*.js | head -3
```

All three must agree:
- `JWT_SECRET` in `.env` == `JWT_SECRET` in every container (especially `dlax-auth` and `dlax-rest`)
- `ANON_KEY` in `.env` == the `eyJ...` strings embedded in `/var/www/dlax-frontend/assets/*.js`

If `dlax-auth` and `dlax-rest` show **different** `JWT_SECRET` values → containers were not recreated together (rare after `docker compose down -v`, but possible if only one was restarted later).

If the bundle's `eyJ...` doesn't match `.env`'s `ANON_KEY` → the frontend was built against an older `.env` and `bun run build` never re-ran.

### Step 2 — Fix

**Case A — secrets are consistent (most common):** The browser is replaying a stale token from a previous install. Fix on the client:
1. Open `http://15.206.37.230/login` in a **fresh incognito window** (or DevTools → Application → Storage → "Clear site data" → reload).
2. Log in again. The new token is signed with the current `JWT_SECRET` and PostgREST will accept it.

**Case B — `dlax-auth` and `dlax-rest` have different secrets:** Recreate the stack so every container picks up `$SUPA/.env`:
```bash
cd $SUPA
sudo docker compose down
sudo docker compose up -d
```
Then clear browser storage as in Case A and log in again.

**Case C — bundle's anon key ≠ `.env` ANON_KEY:** Rebuild the frontend. Simplest path is a full re-run:
```bash
cd /home/ubuntu/dlax-workforce-tracker-d2ea8e3d-main
git pull --rebase
sudo SERVER_IP=15.206.37.230 ADMIN_LOGIN_ID=admin ADMIN_PASSWORD='admin123456' ./install.sh
```
Then incognito + log in.

### Step 3 — Verify

After fix, from the server:
```bash
ANON=$(sudo grep ^ANON_KEY= $SUPA/.env | cut -d= -f2)
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  http://127.0.0.1:8000/rest/v1/profiles?select=user_id\&limit=1
```
Expect `200` (or `200`/`empty array`), not `401`/`403`.

In the browser, after a fresh login, the network tab should show requests to `/rest/v1/...` returning `200`, not PGRST301.

## No code changes are required for this issue.

The 403 you fixed earlier needed migration GRANTs. This new error is purely a key/token-mismatch operational issue on the self-hosted stack, not a bug in the app code. If Step 1 shows Case A (which it almost certainly will, given `install.sh` was just re-run), the only action is clearing browser storage.

If after running Step 1 the output shows a mismatch I haven't anticipated, paste it and I'll adjust the plan before any code or script change.