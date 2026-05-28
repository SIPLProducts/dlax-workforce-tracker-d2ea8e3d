## What broke

Database is fully set up now (all migrations applied, admin user seeded). The build also succeeds — but `install.sh` expects the old `.output/` directory layout from Nitro/Node-target TanStack builds. The current template uses **`@cloudflare/vite-plugin`**, which emits:

```
dist/client/        ← static assets
dist/server/
  index.js          ← Cloudflare Worker bundle (workerd runtime)
  wrangler.json     ← auto-generated worker config
  .dev.vars         ← env-var file for the worker
```

This is a **Cloudflare Worker bundle**, not a Node server. PM2 cannot run it with `node …` — it needs the `workerd` runtime, which is shipped by `wrangler`.

## Plan

Update **`install.sh` only**. No app code, no Vite config, no Cloudflare plugin removal. Run the Worker locally via `wrangler dev --local` (which embeds `workerd`) under PM2, still bound to 127.0.0.1:3000, still proxied by nginx on :80.

### Changes to `install.sh`

1. **Install wrangler globally** alongside the other npm tools:
   ```bash
   npm install -g wrangler
   ```
2. **Replace the `.output/`-based deploy block** with:
   ```bash
   [ -d "$SRC/dist/server" ] || die "build did not produce dist/server/"
   [ -d "$SRC/dist/client" ] || die "build did not produce dist/client/"
   rsync -a --delete "$SRC/dist/client/" "$FRONTEND/"
   rsync -a --delete "$SRC/dist/server/" "$BACKEND/"
   ```
3. **Write a fresh `.dev.vars`** inside `$BACKEND` (wrangler reads it for `process.env` inside the worker — this is how server-side Supabase secrets reach the handler):
   ```
   SUPABASE_URL=http://127.0.0.1:8000
   SUPABASE_PUBLISHABLE_KEY=$ANON
   SUPABASE_SERVICE_ROLE_KEY=$SRK
   ```
   (overwrites the build-time `.dev.vars` so prod-on-server values win)
4. **Replace the PM2 start command**:
   ```bash
   pm2 start wrangler --name dlax --cwd "$BACKEND" -- \
     dev index.js --local --ip 127.0.0.1 --port "$APP_PORT" --no-bundle \
     --config wrangler.json --var-file .dev.vars
   ```
   (If `--var-file` is not a wrangler flag in the installed version, fall back to `.dev.vars` autodiscovery — wrangler picks it up from `cwd` automatically.)
5. **Keep nginx config exactly as-is** — it already proxies `/` → `127.0.0.1:3000` (the worker), `/supabase/` → `127.0.0.1:8000` (kong), `/studio/` → `127.0.0.1:8001`.
6. **Drop the now-obsolete `ENTRY` detection loop** that looked for `server/index.mjs` under `.output/`.

### Why not switch the build target to Node SSR

That would mean removing `@cloudflare/vite-plugin`, changing the Lovable-managed Vite config wrapper, and likely editing files the template warns not to touch. Running the existing Worker bundle under `workerd` via wrangler is the minimum change that gets you live on AWS today, and matches what the framework expects.

### Re-deploy

```bash
sudo ADMIN_PASSWORD='admin2026' ./install.sh
```

The wipe step at the top already drops the dist/, node_modules/, PM2 process, and nginx site, so a re-run is clean.

## Files changed

- `install.sh` — install wrangler; deploy from `dist/client` + `dist/server`; PM2 starts `wrangler dev --local`; write `.dev.vars` for server-side secrets.
