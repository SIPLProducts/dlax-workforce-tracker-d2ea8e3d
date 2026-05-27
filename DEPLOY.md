# DLAX one-shot deploy

Deploys self-hosted Supabase + the DLAX app onto a fresh Ubuntu 22.04 / 24.04 server.
End state: app live at `http://SERVER_IP:3000`, Supabase Studio at `http://SERVER_IP:8000`,
schema applied, one admin user seeded, everything running under PM2 + Docker.

## 0. What to copy to the server

Put these three things under `/root/DLAX/` on the server:

```
/root/DLAX/
  deploy.sh           # this script
  source/             # the DLAX project (full Lovable repo: src/, supabase/, package.json, ...)
  supabase-stack/     # the v17 self-host bundle (docker-compose.yml + scripts/ + volumes/)
```

From your laptop, for example:

```bash
# zip the Lovable project locally as dlax-source.zip, then:
scp deploy.sh dlax-source.zip dlax-selfhost-complete-v17.zip root@SERVER_IP:/root/
ssh root@SERVER_IP
mkdir -p /root/DLAX && cd /root/DLAX
unzip /root/dlax-source.zip            -d source
unzip /root/dlax-selfhost-complete-v17.zip -d supabase-stack-tmp
mv supabase-stack-tmp/*/  supabase-stack    # flatten if the zip had one top-level folder
mv /root/deploy.sh .
chmod +x deploy.sh
```

## 1. Run it

```bash
# Recommended: set a real admin password first
export ADMIN_PASSWORD='YourStrongPass#2026'
export ADMIN_LOGIN_ID='admin'

sudo -E bash /root/DLAX/deploy.sh
```

That's it. First run takes 5–10 minutes (apt installs, Docker pull, `bun install`, build).
The script prints a summary at the end with all URLs and credentials.

## 2. Useful flags

```bash
sudo bash /root/DLAX/deploy.sh --rebuild-app   # rebuild only the app, leave Supabase alone
sudo bash /root/DLAX/deploy.sh --reset         # wipe DB volumes + built artifacts, then redeploy
```

## 3. Where things live after deploy

| What                          | Path                                  |
|-------------------------------|---------------------------------------|
| Frontend (client assets)      | `/root/DLAX/frontend/`                |
| Backend (TanStack SSR server) | `/root/DLAX/backend/`                 |
| Supabase docker stack         | `/root/DLAX/supabase-stack/`          |
| Supabase secrets (.env)       | `/root/DLAX/supabase-stack/.env`      |
| App env                       | `/root/DLAX/source/.env`              |
| PM2 process                   | `pm2 status dlax`, `pm2 logs dlax`    |

## 4. Firewall

Open these inbound ports on the server (UFW / cloud security group):

- **3000** — DLAX app
- **8000** — Supabase API + Studio

```bash
ufw allow 3000/tcp
ufw allow 8000/tcp
```

## 5. Updating the app later

```bash
# replace /root/DLAX/source with the new project files, then:
sudo bash /root/DLAX/deploy.sh --rebuild-app
```

## 6. Troubleshooting

- **DB not healthy:** `cd /root/DLAX/supabase-stack && docker compose logs db | tail -100`
- **Migrations fail:** they're applied as the local `postgres` superuser via `docker exec` — fix the SQL, then re-run `deploy.sh`.
- **App 502:** `pm2 logs dlax`. Common cause = wrong Supabase URL; check `/root/DLAX/backend/.env`.
- **Forgot admin password:** delete the user in Supabase Studio (Auth → Users) and re-run `deploy.sh` with a new `ADMIN_PASSWORD`.

## 7. Security notes

- This is HTTP only on IP+port. For production add a reverse proxy (Caddy / Nginx) and TLS.
- The generated `JWT_SECRET`, `SERVICE_ROLE_KEY`, and `POSTGRES_PASSWORD` live in `/root/DLAX/supabase-stack/.env` (mode 600). Back it up; losing it means losing access.
- Change the seeded admin password after first login.
