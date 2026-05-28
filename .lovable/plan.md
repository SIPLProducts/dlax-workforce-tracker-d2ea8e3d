## Plan: Expose services directly on ports 8000/8001/3000

AWS SG now allows inbound 80, 3000, 8000, 8001. Switch from nginx hostname vhosts (nip.io) to direct `IP:PORT` access.

### Changes to `install.sh`

1. **Bind containers to 0.0.0.0 instead of 127.0.0.1**
   - In `supabase-stack/docker-compose.yml`, change port mappings:
     - kong: `"${KONG_HTTP_PORT}:8000/tcp"` (drop `127.0.0.1:`)
     - studio: `"${STUDIO_PORT}:3000/tcp"` (drop `127.0.0.1:`)
     - db: keep `127.0.0.1:5432` (DB stays internal)
   - In `install.sh`, start wrangler with `--ip 0.0.0.0` so the app worker on :3000 is reachable externally.

2. **Update env URLs to use direct `IP:PORT`**
   - `supabase-stack/.env`:
     - `SITE_URL=http://$SERVER_IP:3000/`
     - `ADDITIONAL_REDIRECT_URLS=http://$SERVER_IP:3000/,http://$SERVER_IP/`
     - `API_EXTERNAL_URL=http://$SERVER_IP:8000`
     - `SUPABASE_PUBLIC_URL=http://$SERVER_IP:8000`
   - App `.env`:
     - `VITE_SUPABASE_URL=http://$SERVER_IP:8000`

3. **Simplify nginx to a single default vhost on :80**
   - Drop `app.<ip>.nip.io` / `api.<ip>.nip.io` / `studio.<ip>.nip.io` server blocks.
   - Keep one `listen 80 default_server` that proxies to the app worker on `127.0.0.1:3000` and serves static `dist/client`.
   - Keep legacy `/supabase/` and `/studio/` path-based fallbacks (harmless).

4. **Update summary printout** to list direct URLs:
   ```
   App      : http://<IP>/        or  http://<IP>:3000/
   Supabase : http://<IP>:8000
   Studio   : http://<IP>:8001   (user: admin / pass: <generated>)
   ```
   Update the security warning to note ports 80/3000/8000/8001 are public-facing and Studio is protected only by basic auth — recommend restricting SG to admin IP for 8001, or keep Studio behind nginx `/studio/` only.

### Files touched
- `install.sh` — wrangler `--ip 0.0.0.0`, env URLs, nginx config simplified, summary
- `supabase-stack/docker-compose.yml` — kong + studio bind `0.0.0.0`

### Re-deploy
```bash
sudo ./install.sh
```

### Security note for user
Exposing Studio (8001) on a public IP means anyone who can reach the EC2 can hit the Studio UI. It has basic auth (admin / generated password) but no rate limiting. Recommended: restrict port 8001 in the AWS SG to your office/home IP only.
