## What's happening

Wrangler crash-looping (94 restarts):
```
✘ The directory specified by the "assets.directory" field does not exist: /root/DLAX/client
```

The build emits `dist/server/wrangler.json` with `assets.directory = "../client"` — wrangler resolves that relative to its `--cwd`, which the installer sets to `/root/DLAX/backend`, so it looks for `/root/DLAX/backend/../client` = `/root/DLAX/client`. We deploy the static files to `/root/DLAX/frontend` instead, so the path doesn't exist and the worker never boots.

Plus all the user-facing URL changes from the previous turn (public IP 15.206.37.230, hostname-based nginx vhosts on :80 for app/api/studio) are still pending — not yet in `install.sh`.

## Plan — single edit to `install.sh`

### 1. Fix the wrangler asset path mismatch

Deploy frontend to `/root/DLAX/client` (the path the generated `wrangler.json` already expects) instead of `/root/DLAX/frontend`. One-line change:

```bash
FRONTEND="$DEPLOY/client"     # was: $DEPLOY/frontend
```

Nginx `root` and the summary printout pick this up automatically since they reference `$FRONTEND`. No need to patch `wrangler.json` after every build.

### 2. Auto-detect public IP

Replace the current single-line IMDSv1 fetch with:
1. IMDSv2 (token first, then `/latest/meta-data/public-ipv4`)
2. `https://api.ipify.org` fallback
3. `hostname -I` (LAN) as last resort before `127.0.0.1`

`SERVER_IP=` env override still wins. On this box step 1 or 2 will return `15.206.37.230`.

### 3. Hostname-based nginx vhosts on :80 (no new AWS ports)

All three `server` blocks listen on `:80`. Uses `nip.io` so no DNS setup is needed.

- `server_name _` (default) → app on `127.0.0.1:3000`, with legacy `/supabase/` and `/studio/` path routes kept as fallback
- `server_name app.15.206.37.230.nip.io` → app
- `server_name api.15.206.37.230.nip.io` → `proxy_pass http://127.0.0.1:8000;` (Kong, root → root, no path rewrite)
- `server_name studio.15.206.37.230.nip.io` → `proxy_pass http://127.0.0.1:8001;` (Studio, with websocket upgrade headers)

Kong and Studio Docker bindings stay on `127.0.0.1` — they're only reachable via nginx.

### 4. App and Supabase env updated

```
# app .env
VITE_SUPABASE_URL=http://api.<SERVER_IP>.nip.io

# supabase-stack/.env
SITE_URL=http://app.<SERVER_IP>.nip.io/
ADDITIONAL_REDIRECT_URLS=http://app.<SERVER_IP>.nip.io/,http://<SERVER_IP>/
API_EXTERNAL_URL=http://api.<SERVER_IP>.nip.io
SUPABASE_PUBLIC_URL=http://api.<SERVER_IP>.nip.io
```

### 5. Updated summary printout

```
App     : http://app.15.206.37.230.nip.io/   (or http://15.206.37.230/)
API     : http://api.15.206.37.230.nip.io
Studio  : http://studio.15.206.37.230.nip.io
```

## Re-deploy

```bash
sudo ./install.sh
# or pin explicitly:
sudo SERVER_IP='15.206.37.230' ADMIN_PASSWORD='admin2026' ./install.sh
```

The wipe step at the top already removes `/root/DLAX/frontend` from the old layout, so re-running is clean.

## Files changed

- `install.sh` only — `FRONTEND` path fix, public-IP auto-detect, hostname vhosts on :80, env URLs, summary.
