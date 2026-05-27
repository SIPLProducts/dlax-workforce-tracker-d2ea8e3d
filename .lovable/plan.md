## Plan

Create a new v12 self-host installer package that fixes the current `repair-db-roles.sh` failure:

```text
psql: error: /tmp/tmp.xk97RPBcal: No such file or directory
```

### What I will change

1. Update `scripts/repair-db-roles.sh`
   - Stop passing a host-side temporary SQL file path into `docker exec`, because that path does not exist inside the database container.
   - Pipe the SQL directly into `psql` inside the container instead.
   - Keep the short command timeouts so it cannot hang indefinitely again.

2. Keep the v11 safety improvements
   - `pg_isready -d postgres` healthcheck.
   - Socket/peer-auth login path for the database superuser.
   - `diagnose-db.sh` fallback tool for collecting root-cause details.

3. Bump package version to `12.0.0`
   - Update installer version text.
   - Add a README note explaining that v12 fixes the temp-file/container-path issue.

4. Generate a new downloadable file
   - Package everything as `dlax-selfhost-complete-v12.zip`.
   - Provide the exact run command after it is created:

```bash
unzip dlax-selfhost-complete-v12.zip
cd dlax-selfhost-supabase
sudo bash install.sh --yes
```

### Expected result

The install should get past `repair-db-roles.sh` without the missing `/tmp/tmp...` file error, and if anything else fails, the included diagnostic script will produce a focused log instead of hanging.