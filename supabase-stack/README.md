# DLAX Self-Host Supabase v17 (Studio-only)

This package brings up a clean Supabase stack (Postgres + Auth + REST + Meta + Studio + Kong)
on your own server. **It does NOT run any DLAX application migrations or seed data automatically.**
You apply DLAX SQL manually from Studio's SQL Editor after the stack is healthy.

## Why v17

Previous versions tried to pre-create `auth.uid()` / `auth.role()` functions and
the `auth` schema before the GoTrue (`dlax-auth`) container booted. GoTrue then
crashed with:

```
ERROR: must be owner of function uid (SQLSTATE 42501)
```

v17 removes all manual creation of `auth.*` objects. The Auth container owns and
creates its own schema, as Supabase intends.

## Requirements

- Linux server with Docker Engine + Docker Compose v2 plugin
- Ports 3000 (Studio), 8000 (Kong/API), 5432 (Postgres) free
- Root / sudo access

## Install

```bash
# from a fresh shell on the server
cd /home/ubuntu
rm -rf dlax-selfhost-supabase
unzip -o dlax-selfhost-complete-v17.zip -d dlax-selfhost-supabase
cd dlax-selfhost-supabase

# If you previously tried v15/v16, wipe the bad DB volume first:
sudo bash scripts/reset-db-volume.sh

# Then install
sudo bash install.sh --yes --studio-only
```

## Open Studio

After install finishes:

- Studio: `http://<your-server-ip>:3000`
- Login user: value of `DASHBOARD_USERNAME` in `.env` (default: `supabase`)
- Login pass: value of `DASHBOARD_PASSWORD` in `.env`

## Apply DLAX SQL manually

1. In Studio → **SQL Editor** → New query.
2. Paste your DLAX migration SQL (in order). Run.
3. Paste your DLAX seed SQL. Run.

Because the `auth` schema is already created by GoTrue at this point,
`public.handle_new_user`, `get_email_for_login_id`, etc. will resolve correctly.

## Important: edit `.env` before going to production

Before exposing this to the internet, edit `.env` and replace:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ANON_KEY` and `SERVICE_ROLE_KEY` (regenerate to match your `JWT_SECRET`)
- `DASHBOARD_PASSWORD`
- `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` to your real host

Then:

```bash
sudo bash scripts/reset-db-volume.sh
sudo bash install.sh --yes --studio-only
```

## Troubleshooting

```bash
docker compose ps
docker logs -f dlax-auth
docker logs -f dlax-db
docker logs -f dlax-kong
```

If `dlax-auth` keeps restarting with `must be owner of function uid`, your DB
volume is from an older install. Run `sudo bash scripts/reset-db-volume.sh`
and reinstall.
