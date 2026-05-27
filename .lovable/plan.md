## Root cause

`dlax-auth` (GoTrue) crash-loops with `required key API_EXTERNAL_URL missing value`. The `docker-compose.yml` `auth` service environment doesn't pass `GOTRUE_API_EXTERNAL_URL` (or the mailer URL paths) even though `.env.example` defines `API_EXTERNAL_URL`. GoTrue reads `GOTRUE_*` prefixed vars, so the value never reaches the container.

## Fix (v4)

1. Patch `docker-compose.yml` `auth.environment` to add:
   ```yaml
   GOTRUE_API_EXTERNAL_URL: ${API_EXTERNAL_URL}
   GOTRUE_MAILER_URLPATHS_INVITE: ${MAILER_URLPATHS_INVITE}
   GOTRUE_MAILER_URLPATHS_CONFIRMATION: ${MAILER_URLPATHS_CONFIRMATION}
   GOTRUE_MAILER_URLPATHS_RECOVERY: ${MAILER_URLPATHS_RECOVERY}
   GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: ${MAILER_URLPATHS_EMAIL_CHANGE}
   ```
2. Add a README troubleshooting note for in-place patching on existing v3 installs:
   ```bash
   # then:
   docker compose up -d auth
   sudo bash install.sh   # resumes health check
   ```
3. Rezip to `/mnt/documents/dlax-selfhost-complete-v4.zip` and re-emit the artifact link.

## Quick manual unblock (no re-download)

Edit `docker-compose.yml`, under the `auth:` service `environment:` block, add the five `GOTRUE_*` lines above (the `${...}` values already exist in `.env`), then:
```bash
docker compose up -d auth
sudo bash install.sh
```

Approve and I'll build v4.