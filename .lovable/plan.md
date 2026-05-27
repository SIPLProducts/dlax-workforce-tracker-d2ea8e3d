## Plan: v17 Studio-only self-host setup

I will create a corrected package that stops interfering with the Auth service’s internal migrations. The install will only bring up the backend + Studio, then stop before applying any DLAX migrations or seed data.

## What will change

1. **Remove manual Auth function creation**
   - Do not create `auth.uid()`, `auth.role()`, or `auth.email()` in any init/repair script.
   - Do not create Auth internal tables manually.
   - Let the `dlax-auth` container own and create its own Auth schema objects.

2. **Keep only safe bootstrap roles/schemas**
   - Create required database roles only if missing.
   - Create schemas only when needed, with ownership set so service migrations can run.
   - Specifically make `auth` schema owned/usable by the role used by the Auth service, instead of pre-creating functions inside it.

3. **Disable all app migration/seed execution during install**
   - `--studio-only` will not run DLAX application migrations.
   - `--studio-only` will not run seed SQL.
   - Installer success condition becomes: database healthy, Auth healthy, REST/Meta/Studio reachable.

4. **Add a clean reset path for broken v16 volumes**
   - Provide one reset command that removes the old local DB volume so the bad `auth.uid()` ownership cannot remain.
   - Then reinstall v17 from a clean volume.

5. **Add clear manual migration instructions**
   - After install, open Studio.
   - Use SQL Editor to paste/run DLAX schema migrations manually.
   - Then paste/run seed data manually.
   - Include log commands if any service still fails.

## Technical fix for your current error

Your current error is:

```text
ERROR: must be owner of function uid (SQLSTATE 42501)
```

That happened because the package created `auth.uid()` before the Auth service ran. Then `dlax-auth` tried to run its own migration with `CREATE OR REPLACE FUNCTION auth.uid()`, but it was not the owner of the existing function.

The v17 fix is: **do not create that function at all**. The Auth service must create it itself.

## Expected install command after v17

```bash
cd /home/ubuntu
rm -rf dlax-selfhost-supabase
unzip -o dlax-selfhost-complete-v17.zip -d dlax-selfhost-supabase
cd dlax-selfhost-supabase
sudo bash scripts/reset-db-volume.sh
sudo bash install.sh --yes --studio-only
```

## Expected result

Studio opens successfully, Auth no longer crashes on `auth.uid()`, and you manually apply DLAX migrations/seed SQL from Studio as requested.