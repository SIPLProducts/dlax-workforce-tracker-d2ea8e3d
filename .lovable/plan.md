## DLAX one-shot `deploy.sh` for Ubuntu

A single `deploy.sh` you copy to the server with the project files, run once, and end up with: self-hosted Supabase + the DLAX TanStack app (frontend + SSR backend) live on `http://SERVER_IP:3000`, schema applied, and one seeded admin user.

### What you copy to the server

```
/root/DLAX/
  deploy.sh              <- the new script
  source/                <- this Lovable project (the full repo: src/, supabase/, package.json, ...)
  supabase-stack/        <- the v17 self-host bundle (docker-compose + volumes + .env.example)
```

Anything else (paths, ports, admin user) is configured by editing the top of `deploy.sh` or via env vars.

### What `deploy.sh` does, in order

1. **Preflight (root, Ubuntu 22.04/24.04)**
   - Install: `curl`, `git`, `jq`, `ca-certificates`, `openssl`, Docker Engine + compose plugin, Node 20 LTS, Bun, PM2 (`npm i -g pm2`).
   - Create `/root/DLAX/frontend` and `/root/DLAX/backend`.

2. **Bring up self-hosted Supabase** (in `/root/DLAX/supabase-stack`)
   - Generate strong secrets on first run and write `.env`: `POSTGRES_PASSWORD`, `JWT_SECRET` (32+ chars), `ANON_KEY` + `SERVICE_ROLE_KEY` (signed from JWT_SECRET), `DASHBOARD_USERNAME/PASSWORD`, `SITE_URL=http://SERVER_IP:3000`, `API_EXTERNAL_URL=http://SERVER_IP:8000`.
   - `docker compose up -d`, then poll `db` + `kong` until healthy.
   - Reuses the v17 fixes (peer-auth `sync-roles.sh`, stale-volume detection).

3. **Apply DLAX schema + seed admin**
   - Run every file in `source/supabase/migrations/*.sql` in order via `docker exec --user postgres dlax-db psql`.
   - Create one auth user using the Supabase Auth Admin API (`POST /auth/v1/admin/users` with `service_role`) using `ADMIN_LOGIN_ID` + `ADMIN_PASSWORD` from `deploy.sh` env (defaults printed at the end). `handle_new_user` trigger auto-promotes the first user to `admin` and creates the profile with `login_id`.

4. **Build the app from `source/`**
   - Write `source/.env` pointing at the local Supabase:
     ```
     VITE_SUPABASE_URL=http://SERVER_IP:8000
     VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
     VITE_SUPABASE_PROJECT_ID=local
     SUPABASE_URL=http://SERVER_IP:8000
     SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
     SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
     ```
   - `bun install` then `bun run build` (TanStack Start Node SSR output).

5. **Split build into `/root/DLAX/frontend` and `/root/DLAX/backend`**
   - The TanStack/Vite build produces `.output/` (server entry) and `.output/public/` (client assets).
   - Copy `.output/public/*` → `/root/DLAX/frontend/` (static client bundle, exactly what gets served to browsers).
   - Copy the rest of `.output/*` + `package.json` → `/root/DLAX/backend/` (Node SSR server + server functions, the runtime piece).
   - This satisfies your "/root/DLAX/frontend" + "/root/DLAX/backend" layout while keeping the app functional — the Node server in `backend/` serves the static files in `frontend/` at runtime.

6. **Run under PM2**
   - `pm2 start /root/DLAX/backend/server/index.mjs --name dlax -- --port 3000` (with `PORT=3000`, `HOST=0.0.0.0`, and the `.env` from step 4 loaded).
   - `pm2 save && pm2 startup systemd` so it auto-starts on reboot.

7. **Final summary printed to console**
   - App URL: `http://SERVER_IP:3000`
   - Supabase Studio: `http://SERVER_IP:8000` (with dashboard user/pass)
   - Admin login: `ADMIN_LOGIN_ID` / `ADMIN_PASSWORD`
   - Secrets file: `/root/DLAX/supabase-stack/.env`
   - PM2 status: `pm2 status dlax`

### Idempotent + safe to re-run

- Re-running `deploy.sh` skips installed packages, reuses existing secrets in `.env`, re-applies migrations (each migration wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` where needed), and `pm2 reload dlax` instead of `start`.
- `deploy.sh --reset` wipes Docker volumes + `/root/DLAX/{frontend,backend}` and starts clean.
- `deploy.sh --rebuild-app` only rebuilds the app (skips Supabase).

### Configurable at top of script

```bash
DLAX_ROOT=/root/DLAX
APP_PORT=3000
SUPABASE_API_PORT=8000
SERVER_IP="$(hostname -I | awk '{print $1}')"   # override with SERVER_IP=...
ADMIN_LOGIN_ID=admin
ADMIN_PASSWORD=ChangeMe123!
```

### Out of scope (call out)

- **No domain / no HTTPS.** Per your choice, this is IP+port HTTP only. Adding Caddy/Nginx + TLS later is a one-file add.
- **No firewall changes.** You'll need ports `3000` (app) and `8000` (Supabase) open in your cloud security group / ufw.
- **No changes to the app code, DB schema, or v17 self-host scripts.** `deploy.sh` only orchestrates what's already in this repo + the v17 bundle.

### Deliverables

- `deploy.sh` (the single entrypoint)
- A short `DEPLOY.md` with the exact 4 commands: `scp` the folder, `chmod +x deploy.sh`, set `ADMIN_PASSWORD`, `./deploy.sh`.

Ready to build this on approval.