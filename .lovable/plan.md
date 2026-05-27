## Diagnosis

The important new line is:

```text
[repair-db-roles] aligning internal role passwords with .env
[warn] repair-db-roles encountered an issue
```

So v6 got past the old `.env` parsing bug, but the repair script itself failed while trying to reset the database roles. Because the installer only prints a generic warning, we still do not see the exact failing command. The likely causes are:

- the script is not running from the correct Docker Compose directory,
- the DB superuser password used by the script does not match the existing database volume,
- the password contains characters that are not safely escaped in the SQL,
- or the role reset commands are being run before the database is fully ready for password-authenticated connections.

## Plan for v7

1. **Make `repair-db-roles.sh` self-locating**
   - Detect its own directory and project root.
   - Run `docker compose` with `--env-file <root>/.env` and `-f <root>/docker-compose.yml` so it works whether invoked from `/root/DLAX/backend`, `/home/ubuntu/dlax-selfhost-supabase`, or anywhere else.

2. **Make password handling SQL-safe**
   - Read `POSTGRES_PASSWORD` without sourcing `.env`.
   - Escape single quotes/backslashes safely before using it in `ALTER ROLE` statements.
   - Use a generated SQL file piped into `psql` instead of fragile inline shell quoting.

3. **Improve DB login recovery**
   - First try to connect as `postgres` using `POSTGRES_PASSWORD`.
   - If that fails, attempt local container socket access where possible.
   - If both fail, print a clear message that the existing Docker volume was initialized with a different postgres password and requires either the old password or a volume reset.

4. **Stop hiding the real repair error**
   - Change `install.sh` so the repair step logs the actual failure output to `/var/log/dlax-install.log` and the console.
   - Keep the installer fail-safe, but make the next action obvious.

5. **Add a destructive reset helper for fresh installs only**
   - Add a separate script such as `scripts/reset-db-volume.sh` that stops services and removes only the DB volume.
   - Clearly label it as destructive and only for fresh/empty installs.
   - Do not run it automatically.

6. **Update README troubleshooting**
   - Add the current exact symptom:
     ```text
     password authentication failed for user "supabase_auth_admin"
     ```
   - Explain the non-destructive repair path.
   - Explain when the destructive DB volume reset is appropriate.

7. **Package corrected archive**
   - Build and provide:
     ```text
     /mnt/documents/dlax-selfhost-complete-v7.zip
     ```

## Expected result

After v7, either:

- the installer repairs `supabase_auth_admin` and `dlax-auth` becomes healthy, or
- it prints the exact reason repair cannot authenticate to the existing DB volume, with a clear recovery command.