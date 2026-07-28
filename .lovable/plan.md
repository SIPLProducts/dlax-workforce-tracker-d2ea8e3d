## Root cause

Chromium browsers only fire `beforeinstallprompt` (and only offer the install UI) when the site satisfies PWA installability: valid manifest + icons + **a registered service worker with a fetch handler served over HTTPS**. This project intentionally has no service worker, so the button never receives the event and clicking does nothing.

The manifest and icons are already correct. What's missing is a service worker.

## Fix — add a guarded PWA service worker via `vite-plugin-pwa`

Follow the Lovable PWA skill (offline path) so the SW is registered only in production and never in the Lovable preview/iframe/dev.

### 1. Install
`bun add -d vite-plugin-pwa`

### 2. `vite.config.ts`
Add `VitePWA` plugin via `defineConfig({ vite: { plugins: [...] } })` with:
- `registerType: "autoUpdate"`
- `injectRegister: null` (we register from our own wrapper)
- `devOptions: { enabled: false }`
- `filename: "sw.js"`
- `manifest: false` (keep existing `public/manifest.webmanifest`)
- `workbox`:
  - `navigateFallback: "/index.html"`, `navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/]`
  - `runtimeCaching`:
    - HTML navigations → `NetworkFirst`
    - same-origin hashed `/assets/*` → `CacheFirst`
  - `globPatterns`: `['**/*.{js,css,html,ico,png,svg,webmanifest}']`

### 3. New file `src/pwa-register.ts`
Guarded registration wrapper that refuses when:
- `!import.meta.env.PROD`
- inside iframe (`window.top !== window.self`)
- hostname starts with `id-preview--` / `preview--`
- hostname is/ends with `lovableproject.com`, `lovableproject-dev.com`, `beta.lovable.dev`
- URL has `?sw=off`
In any refused case, unregister any existing `/sw.js` registration and return.
Otherwise call `registerSW({ immediate: true })` from `virtual:pwa-register`.

### 4. Call the wrapper once
Import `./pwa-register` from `src/router.tsx` (or `src/start.ts` client entry) so it runs after hydration in the browser bundle only.

### 5. Manifest link
Ensure `<link rel="manifest" href="/manifest.webmanifest">` and `<meta name="theme-color" content="#0f1b3d">` are present in `src/routes/__root.tsx` head. If missing, add them (needed for install criteria).

### 6. `InstallAppButton` — no logic change
Once the SW is live in production, `beforeinstallprompt` fires and the existing button prompts the native install dialog on Chromium/Android. iOS branch (Add to Home Screen instructions) already works.

## Deployment note

The install prompt will NOT appear in the Lovable in-editor preview (iframe + preview hostname → guard refuses SW registration by design). It will work on:
- The published site `https://dlax-workforce-tracker.lovable.app`
- Your custom domain `https://dlax.siplproducts.com` and self-hosted `https://dlax.kpc.co` after you rebuild + redeploy the frontend

On the self-hosted server the usual rebuild/rsync cycle applies. Nothing changes on the backend.

## Technical section

- Deps: add `vite-plugin-pwa` (dev).
- Files edited: `vite.config.ts`, `src/router.tsx` (or client entry), `src/routes/__root.tsx` (head tags if missing).
- Files added: `src/pwa-register.ts`.
- Files unchanged: `public/manifest.webmanifest`, icons, `InstallAppButton.tsx`, login layout.
- No hand-written `public/sw.js` — Workbox generates it.
