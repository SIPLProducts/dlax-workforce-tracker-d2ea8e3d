I’ll make a new clean package, e.g. `dlax-selfhost-studio-only-v15.zip`, focused on one goal: Supabase services + Studio login working reliably. It will not auto-apply DLAX app migrations or seed data.

## What I will change

1. Create a Studio-only installer path
   - Keep Docker Compose Supabase services: db, auth, rest, realtime, storage, meta, studio, kong/functions if already needed by the stack.
   - Remove or bypass automatic DLAX schema migrations and seed execution during install.
   - End install once services are healthy and Studio is reachable.

2. Fix the current root issue: missing reserved schemas
   - Add a DB init script that creates required schemas before service containers run migrations:
     - `auth`
     - `storage`
     - `realtime`
     - `extensions`
     - `graphql_public` if required by the compose stack
   - Grant ownership/permissions to the correct service roles so Auth can create its own internal tables.
   - Keep the public schema grants already added for service roles.

3. Make role/password repair safe and simple
   - Keep the corrected no-temp-file, no-`:pw` role repair method.
   - Ensure missing internal roles are created.
   - Ensure every internal service role gets the `.env` password it expects.

4. Add a hard reset option for failed previous attempts
   - Provide a clear command that stops containers and removes only the local Docker volumes for this self-host stack.
   - This gives a clean database so the new init scripts run from the beginning.

5. Add final user instructions
   - Install command:
     ```bash
     unzip -o dlax-selfhost-studio-only-v15.zip -d dlax-selfhost-supabase
     cd dlax-selfhost-supabase
     sudo bash install.sh --yes --studio-only
     ```
   - Open Studio URL, login credentials, and where to paste SQL migrations/seed manually.
   - Include a troubleshooting command to show service logs if Studio/Auth still fails.

## Expected result

After install, you should be able to open Supabase Studio, log in, and manually run your DLAX migrations and seed SQL from the SQL editor without the installer trying to apply them automatically.