# Clean new install script: `install.sh`

Single, minimal script. No legacy code, no flags, no helpers. Run it on a fresh Ubuntu 22.04/24.04 box and you get the app running.

```bash
cd /root/DLAX           # where you unzipped the repo
chmod +x install.sh
sudo -E ADMIN_PASSWORD='YourPass#2026' ./install.sh
```

## What it installs (only what's needed)
- **docker + compose plugin** — runs Supabase
- **Node 20** — needed by bun's build and pm2
- **bun** — installs deps + builds the app
- **pm2** — keeps the Node SSR server up
- **jq, openssl, curl, rsync** — for env generation + admin seeding

Nothing else. No git, no unzip (you already unzipped), no uuid-runtime.

## What it does (top to bottom, ~150 lines)
1. **Wipe** — `pm2 delete dlax`, `docker compose down -v`, remove `dlax-*` containers/volumes, delete `frontend/ backend/ .output/ node_modules/ .env supabase-stack/.env`
2. **Install deps** — only if missing (idempotent checks)
3. **Generate `supabase-stack/.env`** — random POSTGRES_PASSWORD, JWT_SECRET, minted ANON_KEY + SERVICE_ROLE_KEY, all SMTP/MAILER placeholders, POSTGRES_DB=postgres, STUDIO_PORT
4. **`docker compose up -d`** in `supabase-stack/`, wait for DB healthy + Kong responding
5. **Apply migrations** — `docker exec --user postgres ... psql -f` for each `supabase/migrations/*.sql`
6. **Seed admin** — POST `/auth/v1/admin/users` (handle_new_user trigger promotes first user to admin)
7. **Write app `.env`** with VITE_*/SUPABASE_*/PORT
8. **`bun install && bun run build`**
9. **Split `.output/`** → `frontend/` (public) + `backend/` (server) + copy `.env`
10. **`pm2 start backend/server/index.mjs --name dlax`**, save, systemd startup
11. **Print summary** — URLs, admin creds, dashboard creds

## Files

- **New:** `install.sh` (clean rewrite, the only script you need)
- **Delete:** `deploy.sh` (old broken one)
- **Delete:** `DEPLOY.md` (replace with short usage block at top of `install.sh` + a new minimal `README-DEPLOY.md`)
- **Keep:** `supabase-stack/docker-compose.yml`, `supabase-stack/volumes/**` (already fixed last round)
- **Keep:** `supabase-stack/scripts/sync-roles.sh` (used by `volumes/db/init/00-roles.sh`? — will verify and delete if orphaned)

## Server entry path
TanStack Start build outputs `.output/server/index.mjs`. Script looks for that exact path first, then falls back to a `find`. No guessing.

## Defaults (override via env vars)
```
ADMIN_LOGIN_ID=admin
ADMIN_PASSWORD=ChangeMe123!     # please change
ADMIN_EMAIL=admin@dlax.local
APP_PORT=3000
SUPABASE_API_PORT=8000
SERVER_IP=<auto from hostname -I>
```

## Confirm before I write

1. Filename **`install.sh`** OK? (or do you prefer keeping `deploy.sh` as the filename, just with clean contents?)
2. Should I also delete `supabase-stack/scripts/` entirely if nothing in compose references it? I'll check before deleting.
