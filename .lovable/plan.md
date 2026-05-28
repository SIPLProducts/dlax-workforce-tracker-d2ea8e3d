# Fresh single-file deploy.sh

## Goal
One script. Run it on a fresh or dirty Ubuntu 22.04/24.04 server and you get a working DLAX app + self-hosted Supabase, with any previous attempt wiped clean first.

```
ssh root@SERVER
cd /root/DLAX        # where you unzipped the repo
chmod +x deploy.sh
sudo -E ./deploy.sh
```

End state:
- App live at `http://SERVER_IP:3000`
- Supabase API + Studio at `http://SERVER_IP:8000`
- Schema applied, admin user seeded
- PM2 keeps the app up across reboots, Docker keeps Supabase up

## What gets removed first (always, no flag needed)
- Stops + deletes all `dlax-*` Docker containers
- Removes Docker volumes: `dlax-supabase_db-data`, `dlax-supabase_storage-data`
- Removes `pm2` process `dlax`
- Deletes `frontend/`, `backend/`, `.output/`, `node_modules/`, `supabase-stack/.env`, app `.env`
- Frees ports 3000, 8000, 5432 if held by old processes

This makes the script truly idempotent — re-running always gives a clean install.

## What the script does (in order)
1. **Preflight** — install: docker + compose, Node 20, bun, pm2, jq, openssl, rsync, unzip
2. **Wipe** — the cleanup block above
3. **Generate `supabase-stack/.env`** — POSTGRES_PASSWORD, JWT_SECRET, mint ANON_KEY + SERVICE_ROLE_KEY, dashboard creds, SMTP placeholders, MAILER_URLPATHS, POSTGRES_DB, STUDIO_PORT, SITE_URL, API_EXTERNAL_URL
4. **Start Supabase** — `docker compose up -d`, wait for `db` healthy + Kong responding
5. **Apply migrations** — `docker exec --user postgres ... psql -f` for every file in `supabase/migrations/`
6. **Seed admin** — POST `/auth/v1/admin/users` with `ADMIN_LOGIN_ID` + `ADMIN_PASSWORD` (handle_new_user trigger promotes first user to admin)
7. **Write app `.env`** — VITE_SUPABASE_URL/KEY, SUPABASE_SERVICE_ROLE_KEY, PORT, HOST, NODE_ENV
8. **Build app** — `bun install && bun run build` → `.output/`
9. **Split output** — `public/` → `frontend/`, rest → `backend/` (with `.env`)
10. **Start under PM2** — locate server entry, `pm2 start ... --name dlax`, `pm2 save`, `pm2 startup systemd`
11. **Print summary** — URLs, admin creds, dashboard creds, useful commands

## Files to change

- **Delete:** `DEPLOY.md` (replaced), old helper scripts under `supabase-stack/scripts/reset-db-volume.sh` and `supabase-stack/install.sh` (no longer used — deploy.sh owns everything)
- **Rewrite:** `deploy.sh` — single self-contained script, no `--reset`/`--rebuild-app` flags (wipe is unconditional, simpler mental model)
- **Keep as-is:** `supabase-stack/docker-compose.yml`, `supabase-stack/volumes/**` (already fixed)
- **Add:** new short `DEPLOY.md` with the 3-line "unzip, chmod, run" instructions + firewall ports + where files live

## Configurable env vars (optional)
```bash
ADMIN_LOGIN_ID=admin            # default
ADMIN_PASSWORD=ChangeMe123!     # CHANGE THIS
ADMIN_EMAIL=admin@dlax.local
APP_PORT=3000
SUPABASE_API_PORT=8000
SERVER_IP=<auto-detected>
```

## Confirm before I write it

1. **Unconditional wipe on every run** — re-running deploy.sh always destroys the DB and re-seeds the admin. OK? Or do you want a `--keep-data` flag to preserve the DB on re-runs (e.g. for app-only rebuilds after code changes)?

2. **Repo layout** — script assumes `deploy.sh` sits next to `package.json` + `supabase-stack/` (i.e. unzip the repo, cd in, run). Confirm that matches how you're copying the zip up.
