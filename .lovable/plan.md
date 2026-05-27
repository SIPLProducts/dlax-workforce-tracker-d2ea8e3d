## Diagnosis

The new failure is different from the previous missing `API_EXTERNAL_URL` issue. `dlax-auth` now reaches the database, but GoTrue is trying to log in as `supabase_auth_admin` with a password that does not match the password stored in the running Postgres volume:

```text
password authentication failed for user "supabase_auth_admin"
```

This usually happens when `.env` / compose variables are regenerated after the database volume already exists, or when the seed SQL creates internal DB users with one password while `docker-compose.yml` passes another password to auth.

## Plan for v5

1. Patch the self-host package so the internal database role passwords are generated and applied consistently.
   - Ensure `supabase_auth_admin` is created/altered with the same password that `dlax-auth` uses.
   - Also check related Supabase service DB roles so rest/storage/realtime do not hit the same mismatch next.

2. Update `install.sh` to be idempotent for existing failed installs.
   - Before service health checks, run a safe DB role-password repair step against the local Postgres container.
   - This lets users rerun `sudo bash install.sh` without deleting Docker volumes.

3. Update README troubleshooting with an in-place recovery command for users already on v4.
   - Include a concise command sequence to repair the running database password mismatch and restart `auth`.

4. Package the corrected archive as:

```text
/mnt/documents/dlax-selfhost-complete-v5.zip
```

5. Provide the new downloadable artifact link after the bundle is generated.