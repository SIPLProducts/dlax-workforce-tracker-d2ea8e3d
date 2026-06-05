## Plan

Fix the self-hosting deploy script so the built backend file and runtime config agree, then add a readiness check so nginx 502s are caught during install instead of after the script reports success.

## Changes

1. **Stop renaming the worker file blindly**
   - Keep `index.mjs` when the generated `wrangler.json` points to `index.mjs`.
   - Only normalize the filename if the runtime config also gets updated consistently.

2. **Make `wrangler.json` and backend bundle self-healing**
   - After copying `dist/server` to `/root/DLAX/backend`, read the `main` value from `wrangler.json`.
   - If that entry file is missing but `index.js` or `index.mjs` exists, update `wrangler.json` to point at the existing file.
   - Ensure the script fails with a clear message if no usable worker entry exists.

3. **Avoid conflicting launch flags**
   - Use the generated `wrangler.json` as the source of truth.
   - Remove the redundant `--no-bundle` CLI flag because the config already contains `no_bundle: true`.

4. **Add backend readiness validation before success output**
   - After PM2 starts the app, poll `http://127.0.0.1:$APP_PORT/`.
   - If it never responds, show recent PM2 logs and fail the install.
   - This prevents the script from printing “DLAX is up” while port 3000 is not actually listening.

## Expected result

After pulling the updated repo and running `sudo bash install.sh`, PM2 should start without restart loops, port `3000` should listen, and nginx on port `80` should stop returning `502 Bad Gateway`.