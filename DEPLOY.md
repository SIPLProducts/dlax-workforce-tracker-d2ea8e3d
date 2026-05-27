# DLAX one-shot deploy

Deploys self-hosted Supabase + the DLAX app onto a fresh Ubuntu 22.04 / 24.04 server.
End state: app live at `http://SERVER_IP:3000`, Supabase Studio at `http://SERVER_IP:8000`,
schema applied, one admin user seeded, everything running under PM2 + Docker.

The repo ships with everything you need:

```
<repo>/
  deploy.sh           # one-shot installer
  DEPLOY.md           # this file
  package.json        # the DLAX TanStack app
  src/                # app source
  supabase/           # migrations
  supabase-stack/     # self-hosted Supabase bundle (docker-compose + scripts)
```

## 1. Copy the repo to the server

Download the repo as a zip (from GitHub or Lovable), `scp` it up, and unzip:

```bash
scp dlax-repo.zip root@SERVER_IP:/root/
ssh root@SERVER_IP
cd /root && unzip dlax-repo.zip      # creates e.g. /root/dlax-main
mv dlax-* /root/DLAX
cd /root/DLAX
chmod +x deploy.sh
```

## 2. Run it

```bash
export ADMIN_PASSWORD='YourStrongPass#2026'
export ADMIN_LOGIN_ID='admin'
sudo -E ./deploy.sh
```

First run takes 5–10 minutes (apt installs, Docker pull, `bun install`, build).
The script prints a summary with URLs and credentials at the end.

## 3. Useful flags

```bash
sudo ./deploy.sh --rebuild-app   # rebuild the app only, leave Supabase running
sudo ./deploy.sh --reset         # wipe DB volumes + built artifacts, then redeploy
```

## 4. Where things live after deploy

| What                          | Path                                  |
|-------------------------------|---------------------------------------|
| Frontend (client assets)      | `<repo>/frontend/`                    |
| Backend (TanStack SSR server) | `<repo>/backend/`                     |
| Supabase docker stack         | `<repo>/supabase-stack/`              |
| Supabase secrets (.env)       | `<repo>/supabase-stack/.env`          |
| App env                       | `<repo>/.env`                         |
| PM2 process                   | `pm2 status dlax`, `pm2 logs dlax`    |

(`<repo>` = wherever you unzipped, e.g. `/root/DLAX`.)

## 5. Firewall

Open these inbound ports on the server (UFW / cloud security group):

- **3000** — DLAX app
- **8000** — Supabase API + Studio

```bash
ufw allow 3000/tcp
ufw allow 8000/tcp
```

## 6. Updating the app later

Pull or re-upload the latest repo and run:

```bash
sudo ./deploy.sh --rebuild-app
```

## 7. Troubleshooting

- **DB not healthy:** `cd supabase-stack && docker compose logs db | tail -100`
- **Migrations fail:** they're applied as the local `postgres` superuser via `docker exec` — fix the SQL, then re-run `deploy.sh`.
- **App 502:** `pm2 logs dlax`. Common cause = wrong Supabase URL; check `backend/.env`.
- **Forgot admin password:** delete the user in Supabase Studio (Auth → Users) and re-run `deploy.sh` with a new `ADMIN_PASSWORD`.

## 8. Security notes

- HTTP only on IP+port. For production add a reverse proxy (Caddy / Nginx) + TLS.
- Generated `JWT_SECRET`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD` live in `supabase-stack/.env` (mode 600). Back it up; losing it means losing access.
- Change the seeded admin password after first login.
