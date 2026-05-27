The v12 failure is caused by `psql` variable syntax `:'pw'` being placed inside a PostgreSQL `DO $$ ... $$` block. `psql` does not expand variables inside that dollar-quoted block, so PostgreSQL receives the literal `:'pw'` and throws `syntax error at or near ":"`.

Plan for v13:

1. Replace the fragile `DO` block in `scripts/repair-db-roles.sh`
   - Remove all `:'pw'` usage inside dollar-quoted SQL.
   - Use a `psql`-native `SELECT format(...) \gexec` approach so password quoting happens safely before each `ALTER ROLE` executes.
   - Keep SQL piped through `docker exec -T` so no host temp file is referenced inside the container.

2. Keep the existing safety behavior
   - Start only the `db` container first.
   - Wait for PostgreSQL readiness with `pg_isready -d postgres`.
   - Verify the current `.env` `POSTGRES_PASSWORD` before attempting role repair.
   - If the existing database volume password does not match `.env`, keep the current clear recovery path / auto-wipe behavior under `--yes`.

3. Improve installer resilience
   - Make `repair-db-roles.sh` print the generated role list and fail with a clear message if `psql` itself fails.
   - Keep `diagnose-db.sh` in the package for one-command diagnostics if the host environment has a separate Docker/network issue.
   - Correct the install marker version so it records the real package version.

4. Package a fresh complete release
   - Build `dlax-selfhost-complete-v13.zip`.
   - Update README instructions for the clean install command:

```bash
unzip -o dlax-selfhost-complete-v13.zip -d dlax-selfhost-supabase
cd dlax-selfhost-supabase
sudo bash install.sh --yes
```

5. Add an emergency fallback command in the README
   - If a user wants to preserve an existing `.env` and DB volume, they can run only:

```bash
sudo bash scripts/repair-db-roles.sh
sudo bash install.sh --yes
```

After approval, I’ll generate the v13 zip with the corrected installer.