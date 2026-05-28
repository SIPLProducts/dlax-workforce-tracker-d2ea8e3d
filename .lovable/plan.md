## Problem

Login is calling `http://api.15.206.37.230.nip.io/rest/v1/rpc/get_email_for_login_id`. That hostname is baked into the **deployed frontend bundle** from a previous install run. Vite inlines `VITE_SUPABASE_URL` at build time, so the only way to change it is a rebuild + redeploy.

Current `install.sh` (already in the repo) is correct — it writes:
```
VITE_SUPABASE_URL=http://$SERVER_IP:$SUPABASE_API_PORT      # → http://15.206.37.230:8000
SITE_URL=http://$SERVER_IP:$APP_PORT/
API_EXTERNAL_URL / SUPABASE_PUBLIC_URL=http://$SERVER_IP:8000
```
and binds kong (8000) + studio (8001) to `0.0.0.0`. So no script changes are strictly required — the deployed artifacts are just stale.

## Plan

### 1. Small `install.sh` hardenings (so the rebuild is clean)

- Add an explicit `rm -rf "$SRC/dist"` to the wipe step so an old `dist/client/` with the cached nip.io URL can never be re-rsynced.
- Echo the resolved `SERVER_IP` and the final `VITE_SUPABASE_URL` before `bun run build`, so any future stale build is obvious in the install log.
- Add a post-build sanity check: `grep -r "nip.io" "$FRONTEND" && die "stale nip.io URL leaked into bundle"`.

No URL/port/nginx/compose logic changes — those are already correct.

### 2. Re-run the installer on the server (this is the actual fix)

```bash
cd /home/ubuntu/dlax-workforce-tracker-d2ea8e3d-main
sudo SERVER_IP=15.206.37.230 ADMIN_PASSWORD='YourPass#2026' ./install.sh
```

After it finishes, the resulting URLs will be:

```text
App      : http://15.206.37.230/        (also http://15.206.37.230:3000/)
Supabase : http://15.206.37.230:8000
Studio   : http://15.206.37.230:8001
```

### 3. Verify

- `pm2 logs dlax` — backend started on `0.0.0.0:3000`.
- `curl -I http://15.206.37.230:8000/auth/v1/health` → `200`.
- In the browser DevTools Network tab on the login page, the auth call must go to `http://15.206.37.230:8000/...`, **not** any `nip.io` host. If it still shows nip.io, it's a browser/SW cache — hard-refresh (Ctrl+Shift+R) or open in a private window.

### 4. Notes / caveats

- Page is loaded over `http://` so the app calling `http://...:8000` is fine (no mixed-content). If you later put the app behind HTTPS, the Supabase URL must also become HTTPS — `http://IP:8000` will be blocked by the browser.
- AWS SG must allow inbound TCP on 80, 3000, 8000, 8001 (you said these are open).
- Studio on `:8001` is only protected by basic auth — recommend restricting that port in the SG to your admin IP.

## Files touched

- `install.sh` — add `rm -rf dist`, echo resolved URLs, add post-build `grep nip.io` guard. No other changes.
