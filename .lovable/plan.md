## Current state (verified)

The PWA install flow is already fully wired in the codebase:

- `public/manifest.webmanifest` — valid manifest with 192/512 icons (any + maskable), `display: standalone`, theme color.
- `vite.config.ts` — `vite-plugin-pwa` configured with `autoUpdate`, `injectRegister: null`, `filename: sw.js`, Workbox `NetworkFirst` for HTML navigations and `CacheFirst` for `/assets/*`, dev disabled.
- `src/pwa-register.ts` — guarded registration wrapper (refuses in dev, iframe, preview hosts, or `?sw=off`; unregisters stale `/sw.js` in refused contexts).
- `src/routes/__root.tsx` — head has `manifest` link, `theme-color`, apple-touch-icon, iOS meta tags; `registerAppPWA()` called from `useEffect`.
- `src/components/InstallAppButton.tsx` — listens for `beforeinstallprompt`, calls `prompt()` on click; iOS fallback popover with Share → Add to Home Screen instructions; "App Installed" state when in standalone.
- `src/routes/login.tsx` — renders the button.

No code changes are required. What's missing is the deployment step — the service worker only becomes active on the built + deployed site (never in the Lovable editor iframe, by design).

## What you need to do to make Install work on mobile

The plan is a deploy checklist, not code edits.

### 1. Rebuild the frontend on your self-hosted server

```bash
cd /root/DLAX
git pull                        # pull the PWA changes into the server
bun install
bun run build
```

This regenerates `dist/client/sw.js`, `dist/client/manifest.webmanifest`, icons, and hashed `/assets/*`.

### 2. Redeploy the built bundle

Restart whatever serves `dist/` (PM2 + wrangler as set up earlier):

```bash
pm2 restart dlax-frontend       # or the actual PM2 process name
pm2 logs dlax-frontend --lines 50
```

For the Lovable-hosted URL (`https://dlax-workforce-tracker.lovable.app` / `https://dlax.siplproducts.com`), just click **Publish → Update** in the Lovable editor. That's it.

### 3. Verify the service worker is live

From a normal browser (not the Lovable preview) on `https://dlax.kpc.co`:

- Open DevTools → Application → Service Workers → should show `/sw.js` **activated and running**.
- Application → Manifest → should show the DLAX manifest with icons, no errors, and "Installability" ticked.
- Network → `sw.js` returns 200, `manifest.webmanifest` returns 200 with `application/manifest+json`.

If the SW doesn't appear, hard-refresh once (Ctrl+Shift+R). The guard is intentional — it will refuse on `id-preview--*` and `preview--*` Lovable hosts, so always test on the real domain.

### 4. Install on device

- **Android (Chrome / Edge / Brave / Samsung Internet):** open `https://dlax.kpc.co`, sign in or reach the login page, tap **Install App**. The native Chromium install sheet appears → **Install** → app icon lands on the home screen and opens standalone (no browser chrome).
- **iOS (Safari — iPhone/iPad):** tap **Install App**, follow the popover: Share → **Add to Home Screen** → **Add**. iOS does not expose `beforeinstallprompt`; this manual flow is the only path Apple allows.
- **Desktop Chrome/Edge:** the install icon appears in the address bar and the button also works.

### 5. If the button doesn't appear on Android

Root causes and fixes, in order:

1. Site not served over HTTPS → install criteria fail. Fix TLS on `dlax.kpc.co`.
2. `sw.js` 404 or wrong MIME → nginx must serve `/sw.js` from `dist/client/` with `Content-Type: application/javascript` and `Service-Worker-Allowed: /`. Confirm with `curl -I https://dlax.kpc.co/sw.js`.
3. Manifest icons 404 → `curl -I https://dlax.kpc.co/icon-192.png` and `/icon-512.png`.
4. Already installed → button shows "App Installed". Uninstall from the home screen to test again.
5. Chrome engagement heuristic — on some Android builds the event fires only after a short interaction. The button stays hidden until then; the iOS-style manual path is not needed there.

### 6. Rolling out updates later

Because `registerType: "autoUpdate"` is set, returning users pick up the new SW on their next page load and it activates on the next navigation — no manual reinstall needed. Only manifest fields cached at install time (`start_url`, `scope`, `display`, `id`) require a reinstall to change.

## Technical section

- No file edits, no dependency changes, no schema changes.
- No changes to auth, RLS, Supabase config, or any business logic.
- The install button, login layout, QR card, and every other route stay exactly as they are.
- The guard in `src/pwa-register.ts` guarantees the SW never registers inside the Lovable editor iframe, so previewing here will keep showing no install prompt — that is expected. Test only on `https://dlax.kpc.co` (or the `.lovable.app` published URL).
