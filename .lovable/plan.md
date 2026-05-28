
# Plan: AWS-friendly one-shot deploy via nginx reverse proxy

## Goal

A single `install.sh` that, on a fresh Ubuntu AWS box where **only port 80 is open**, produces:

- App reachable at `http://<server-ip>/`
- Supabase API reachable at `http://<server-ip>/supabase/` (auth, rest, storage, realtime, studio under sub-paths)
- Frontend deployed to `/root/DLAX/frontend`
- Backend deployed to `/root/DLAX/backend`
- All Supabase/Postgres/PM2 internal ports bound to `127.0.0.1` only — no public exposure

## Root cause of the current hang

`install.sh` waits on `http://127.0.0.1:8000/auth/v1/health`. The stack starts but the wait loop times out because:

1. `kong.yml` has no `/storage/v1`, `/realtime/v1`, or top-level health route — only `/auth/v1/`, `/rest/v1/`, `/pg/`. The probe URL works against `/auth/v1/health` (GoTrue exposes `/health`), but only AFTER GoTrue finishes its own DB migrations.
2. GoTrue migrations need `supabase_auth_admin` to own/CREATE the `auth` schema. The current `00-roles.sh` only creates the role with `CREATEROLE` and a password — it does not `CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin` or grant it on the `postgres` DB, so on a fresh volume GoTrue boots, fails its migration, and restarts forever — making `/auth/v1/health` never return 200.
3. The existing stack is also missing a `storage` container, which the app will need for any file feature.

## New `install.sh` — outline

Single script, idempotent, wipes previous install on every run. Runs as root.

### 1. Install only what is needed
- `curl ca-certificates gnupg jq openssl rsync`
- Docker Engine + compose plugin
- Node 20 + bun + pm2
- **nginx** (new)

### 2. Wipe previous install
- `pm2 delete dlax`
- `docker compose down -v` in `supabase-stack/`
- Remove `dlax-*` containers + named volumes
- Remove `/root/DLAX/frontend`, `/root/DLAX/backend`, repo's `.output`, `node_modules`, `.env`, `supabase-stack/.env`
- Disable + remove old nginx site `/etc/nginx/sites-enabled/dlax`

### 3. Generate `supabase-stack/.env`
- Random `POSTGRES_PASSWORD`, `JWT_SECRET`, `DASHBOARD_PASSWORD`
- Mint `ANON_KEY` + `SERVICE_ROLE_KEY` JWTs with `openssl` (existing `mint_jwt` helper)
- `SITE_URL=http://<server-ip>/`
- `API_EXTERNAL_URL=http://<server-ip>/supabase`
- `SUPABASE_PUBLIC_URL=http://<server-ip>/supabase`
- Internal-only ports: `KONG_HTTP_PORT=8000`, `POSTGRES_PORT=5432`, `STUDIO_PORT=8001` (these get bound to `127.0.0.1` in compose, see step 5)

### 4. Patch `supabase-stack/volumes/db/init/00-roles.sh`
Add — after roles are created — the missing schema bootstrap so GoTrue migrations succeed on a fresh volume:

```sql
CREATE SCHEMA IF NOT EXISTS auth   AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
GRANT ALL ON DATABASE postgres TO supabase_auth_admin, supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER ROLE supabase_auth_admin SET search_path = auth, public;
ALTER ROLE supabase_storage_admin SET search_path = storage, public;
```

### 5. Update `supabase-stack/docker-compose.yml`
- Bind every published port to `127.0.0.1` only:
  - `db`: `127.0.0.1:5432:5432`
  - `kong`: `127.0.0.1:8000:8000` (remove `:8443`)
  - `studio`: `127.0.0.1:8001:3000`
- Add **`storage`** service (`supabase/storage-api:v1.11.13`) wired to db + a `storage-data` named volume, with `STORAGE_BACKEND=file`, `FILE_STORAGE_BACKEND_PATH=/var/lib/storage`, `PGRST_JWT_SECRET=${JWT_SECRET}`, `DATABASE_URL=postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`
- Add **`realtime`** service (`supabase/realtime:v2.30.34`) — optional but needed for any live updates
- Update healthchecks so the readiness wait can actually become true

### 6. Update `supabase-stack/volumes/api/kong.yml`
Add routes for `/storage/v1/`, `/realtime/v1/`, and a top-level health endpoint `/health` proxied to `auth:9999/health` so the wait loop has a deterministic 200. Make the existing `auth-v1` route also accept `OPTIONS` (CORS).

### 7. Bring stack up + readiness wait
- `docker compose up -d` from `supabase-stack/`
- Wait for `dlax-db` health = `healthy` (existing pattern)
- Wait for `dlax-auth` to log `GoTrue API started` (poll `docker logs --tail` for that line) — this is what was actually missing as a signal
- Wait for `curl http://127.0.0.1:8000/auth/v1/health` → 200 (max 120 s, then dump `docker compose logs auth | tail -100` and abort with a clear message)

### 8. Apply project migrations
Same as today: copy `supabase/migrations/*.sql` into `dlax-db` and `psql -f`.

### 9. Seed admin user
Same as today via `POST /auth/v1/admin/users` with `SERVICE_ROLE_KEY` — but call against `127.0.0.1:8000` (internal), not the public URL.

### 10. Build the TanStack app
- Write `/root/DLAX/.env` with:
  - `VITE_SUPABASE_URL=http://<server-ip>/supabase`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=$ANON`
  - `SUPABASE_URL=http://127.0.0.1:8000` (server-side, fast in-Docker hop)
  - `SUPABASE_PUBLISHABLE_KEY=$ANON`
  - `SUPABASE_SERVICE_ROLE_KEY=$SRK`
  - `PORT=3000`, `HOST=127.0.0.1`, `NODE_ENV=production`
- `bun install && bun run build` in the repo root
- `rsync -a .output/public/ /root/DLAX/frontend/`
- `rsync -a --exclude=public .output/ /root/DLAX/backend/`
- `cp .env /root/DLAX/backend/.env`

### 11. Start backend under PM2 (bound to localhost)
- `pm2 start /root/DLAX/backend/server/index.mjs --name dlax --cwd /root/DLAX/backend --update-env`
- `pm2 save && pm2 startup systemd -u root --hp /root`

### 12. Configure nginx as the public face (only port 80)

Write `/etc/nginx/sites-available/dlax`:

```nginx
server {
  listen 80 default_server;
  server_name _;

  client_max_body_size 50m;

  # Static frontend assets
  root /root/DLAX/frontend;
  index index.html;

  # SSR / server functions go to the bun/pm2 backend
  location / {
    try_files $uri @ssr;
  }

  location @ssr {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # Supabase API (everything under /supabase/* is stripped and proxied to kong)
  location /supabase/ {
    rewrite ^/supabase/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
  }

  # Supabase Studio (optional admin UI)
  location /studio/ {
    rewrite ^/studio/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:8001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

- Symlink to `sites-enabled/`, remove `default`
- `nginx -t && systemctl reload nginx`

### 13. Final summary
Print:
- App URL: `http://<server-ip>/`
- Supabase API: `http://<server-ip>/supabase/`
- Studio: `http://<server-ip>/studio/` (dashboard admin / printed password)
- Admin login id + password
- Path to `supabase-stack/.env` (the secrets file — back it up)
- `pm2 logs dlax`, `cd supabase-stack && docker compose logs -f`, `journalctl -u nginx`

## Files changed

- `install.sh` — rewritten from scratch with the above
- `supabase-stack/docker-compose.yml` — bind ports to 127.0.0.1, add `storage` + `realtime`, add `storage-data` volume
- `supabase-stack/volumes/api/kong.yml` — add `/storage/v1/`, `/realtime/v1/`, `/health` routes
- `supabase-stack/volumes/db/init/00-roles.sh` — add schema + grant bootstrap so GoTrue migrations succeed on fresh volume

## What stays in code

- All of `src/`, all migrations under `supabase/migrations/`, `src/integrations/supabase/client.ts` (auto-generated) untouched.

## AWS Security Group reminder (printed in final summary)

> Only inbound `tcp/80` needs to be open. Postgres (5432), Kong (8000), Studio (8001), and the bun server (3000) all bind to `127.0.0.1` and are unreachable from the public network.
