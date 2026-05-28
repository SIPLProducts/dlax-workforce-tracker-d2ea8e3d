# Apply the login-loop fix on the Linux server

The code fix for the post-login redirect is already in this Lovable workspace (`use-auth.tsx`, `RootShell.tsx`, `AuthGuard.tsx`). Your Linux server is still serving the old built bundle, so it keeps bouncing back to `/login`. Once those commits are pulled and the client is rebuilt on the server, the loop stops.

## Steps to run on the server

```bash
cd /home/ubuntu/dlax-workforce-tracker-d2ea8e3d-main   # or wherever the repo lives
git pull --rebase
sudo SERVER_IP=15.206.37.230 \
     ADMIN_LOGIN_ID=admin \
     ADMIN_PASSWORD='admin123456' \
     ./install.sh
```

`install.sh` re-renders the `.env`, rebuilds the client with the correct `VITE_SUPABASE_URL=http://15.206.37.230:8000`, and restarts pm2 — that's enough to ship the auth fix.

## After it finishes

1. **Hard-refresh the browser** (Ctrl+Shift+R) or open an incognito window — the old JS bundle and the stale `sb-*-auth-token` in `localStorage` can otherwise mask the fix.
2. Go to `http://15.206.37.230/login`, sign in as `admin / admin123456`.
3. You should land on `/` and stay there. Refreshing `/` should keep you logged in.

## If it still bounces after the rebuild

Capture and share these so I can pinpoint it without guessing:

- Browser DevTools **Console** tab output during login.
- Browser DevTools **Network** tab: the `token?grant_type=password` request (status + response body, with the access_token redacted) and any subsequent `/auth/v1/user` or `/rest/v1/...` requests that return 401/403.
- Output of:
  ```bash
  grep VITE_SUPABASE /home/ubuntu/dlax-workforce-tracker-d2ea8e3d-main/.env
  curl -s http://127.0.0.1:8000/auth/v1/health
  ```

The most common server-only causes after this fix are:
- `VITE_SUPABASE_URL` baked into the bundle points somewhere the browser can't reach (e.g. `127.0.0.1:8000` instead of `15.206.37.230:8000`).
- AWS Security Group not allowing inbound TCP 8000 from your laptop, so the token refresh silently fails and the client signs itself out.
- JWT secret in `supabase-stack/.env` was regenerated but the issued admin token was minted against the old secret, so the next refresh is rejected. A clean wipe (`./install.sh` already handles the env regen) plus clearing browser storage fixes it.

No code changes are needed in this turn — this is a deploy + verify plan.
