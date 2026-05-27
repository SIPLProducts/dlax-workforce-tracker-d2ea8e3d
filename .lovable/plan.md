## Goal

Produce a production-ready, idempotent Bash deployment kit for a self-hosted Supabase stack on Ubuntu 26, installed at `/root/DLAX/backend`, that can deploy this existing DLAX project (auto-applies `supabase/migrations/*.sql` in order) and ships with helper scripts, sample env, override compose, and optional Nginx + SSL.

Note: this is an infrastructure deliverable — files are generated into `/mnt/documents/` as a downloadable bundle (and previewed as artifacts). Nothing in the Lovable app codebase (`src/`, `supabase/config.toml`, the managed Lovable Cloud project) is modified. Self-hosting Supabase is independent of Lovable Cloud.

## Deliverables (single zip + individual artifacts)

```
dlax-selfhost-supabase/
  install.sh                  # one-shot installer (root)
  .env.example                # all secrets/URLs, with generation hints
  docker-compose.yml          # full Supabase stack
  docker-compose.override.yml # local overrides (ports, extra mounts)
  volumes/
    db/init/                  # roles, schemas, realtime, webhooks, _supabase init SQL
    api/kong.yml              # Kong declarative config (anon/service routes)
    functions/main/index.ts   # edge functions entrypoint placeholder
    logs/vector.yml           # log shipping config
  nginx/
    dlax.conf.example         # reverse proxy for studio + api + (optional) functions
    README-ssl.md             # certbot / self-signed steps
  scripts/
    bootstrap.sh              # apt: docker, compose plugin, git, curl, jq, openssl, ufw
    preflight.sh              # OS/version/ram/disk/ports checks
    gen-secrets.sh            # generates JWT secret, anon+service keys, DB pw, dashboard pw
    up.sh / down.sh / restart.sh / status.sh / logs.sh
    migrate.sh                # applies /supabase/migrations/*.sql in lexicographic order
    seed.sh                   # applies supabase/seed.sql if present
    rollback.sh               # restores last DB snapshot + previous compose
    update.sh                 # pulls newer image tags, runs migrations
    upgrade.sh                # major version bump w/ pre-backup + confirm prompt
    backup.sh / restore.sh    # pg_dump + volume tar to ./backups/<ts>/
    healthcheck.sh            # curls each service, exits non-zero on fail
    print-summary.sh          # prints URLs, creds, common commands
  README.md
```

## install.sh behavior (high level)

1. `set -Eeuo pipefail`, trap → log file at `/var/log/dlax-install.log` (tee).
2. Refuse if not root; refuse if `$TARGET_DIR` (default `/root/DLAX/backend`) is dirty unless `--force` or matches a prior install marker (`.dlax-installed`).
3. Run `scripts/preflight.sh`: Ubuntu 24/26 check, ≥2 vCPU / 4 GB RAM / 20 GB free, ports 80/443/3000/5432/8000/8443 free (warn, don't fail), kernel ≥ 5.15.
4. Run `scripts/bootstrap.sh`: apt update, install `ca-certificates curl gnupg git jq openssl ufw`, add Docker apt repo, install `docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`, enable + start `docker`, add current user to `docker` group (no-op for root).
5. `mkdir -p /root/DLAX/backend && cd` there. `git`-init only if user passed `--from-git <url>`; otherwise copy the bundled files in place. Idempotent: skip files that already exist unless `--reset-config`.
6. If `.env` missing → copy `.env.example` → call `scripts/gen-secrets.sh` to fill: `POSTGRES_PASSWORD`, `JWT_SECRET` (32B hex), `ANON_KEY`, `SERVICE_ROLE_KEY` (signed HS256 against `JWT_SECRET` with `role: anon|service_role`, exp 10y), `DASHBOARD_USERNAME/PASSWORD`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `LOGFLARE_API_KEY`, SMTP placeholders, `SITE_URL`, `API_EXTERNAL_URL`, `STUDIO_DEFAULT_ORGANIZATION/PROJECT`.
7. Look for `supabase/migrations/` next to the script (or `--migrations-dir <path>`). Stage them into `./migrations-staged/` preserving filenames.
8. `docker compose pull && docker compose up -d`.
9. `scripts/healthcheck.sh` — polls Kong `/`, GoTrue `/health`, Postgres `pg_isready`, Storage `/status`, Realtime `/api/health`, Studio `/`, Meta `/health` with 60s timeout and exponential backoff.
10. Once DB healthy → `scripts/migrate.sh` (psql via the `db` container, sorted by filename, recorded in a `public._dlax_migrations(name, applied_at, checksum)` table; skip already-applied checksums; abort + restore on failure).
11. If `supabase/seed.sql` present → `scripts/seed.sh` (only first run, gated by marker).
12. Optional `--with-nginx [--domain studio.example.com --email you@x]`: install nginx, copy `nginx/dlax.conf.example` → `/etc/nginx/sites-available/dlax.conf` with substitutions, enable site, run certbot if `--email` given, else leave SSL placeholders + print instructions.
13. Write `/root/DLAX/backend/.dlax-installed` (version, date, image digests).
14. `scripts/print-summary.sh` prints:
    - Studio URL, REST URL, Auth URL, Realtime URL, Storage URL, Functions URL
    - Postgres connection string (host/port/db/user, password masked + path to `.env`)
    - Anon + service keys (truncated, file path for full values)
    - Common commands: `./scripts/{up,down,restart,logs,status,migrate,backup,update}.sh`

## Compose stack

Pinned Supabase image tags (current stable line):
- `supabase/postgres:15.8.x` with persistent volume `db-data`, init scripts mounted read-only.
- `kong:2.8.1` (declarative `kong.yml`).
- `supabase/gotrue:v2.x`, `supabase/realtime:v2.x`, `supabase/storage-api:v1.x`, `supabase/postgres-meta:v0.x`, `supabase/studio:latest-stable`, `supabase/edge-runtime:v1.x`, `supabase/logflare:latest`, `imgproxy:v3`, `timberio/vector:0.x`.
- Each service: `restart: unless-stopped`, healthcheck, dependency `depends_on: { db: { condition: service_healthy } }`, env from `.env`, named volumes for `db-data`, `storage-data`, `functions`, `logs`.
- `docker-compose.override.yml` exposes ports for local dev and adds `./volumes/functions:/home/deno/functions` bind mount so the user can drop in TS files.

## Safety / re-run semantics

- Every script is `set -Eeuo pipefail` + has `--help`.
- Migrations tracked by checksum in a dedicated table → safe to rerun; mismatched checksum aborts with diff hint.
- `update.sh`: `docker compose pull` → `backup.sh` → `up -d` → `migrate.sh` → `healthcheck.sh`; rolls back on health failure.
- `rollback.sh`: stops stack, restores newest `backups/<ts>/db.sql.gz` + volume tar, brings previous image tags back from `.dlax-installed.prev`.
- All destructive commands prompt unless `--yes`.

## Out of scope

- No changes to the Lovable project (`src/`, `supabase/config.toml`, Lovable Cloud DB).
- No automatic DNS, no paid TLS cert purchase (certbot only).
- No migration of existing Lovable Cloud data into self-hosted Postgres (can be added later via `pg_dump` from the managed DB — call out in README).

## Open question (will assume default if no reply)

Default assumption: bundle the kit as a downloadable zip under `/mnt/documents/dlax-selfhost-supabase.zip` plus a previewable `README.md` and `install.sh`. Reply if you'd rather have it dropped into the repo at `deploy/selfhost/` instead.
