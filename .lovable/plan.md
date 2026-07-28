## Goal

On the login screen, always show a PWA action button (both desktop left panel and mobile view). Its label adapts:

- Not installed, native prompt available → **Install App** (fires `beforeinstallprompt.prompt()`).
- Not installed, no native prompt yet (iOS, or Android before engagement heuristic) → **Install App** opens a help popover with per-platform instructions.
- Already installed (running standalone) → **App Installed**.
- Service worker has a waiting update → **Update Available** — clicking calls `skipWaiting` and reloads.

## Changes

### 1. `src/components/InstallAppButton.tsx`
- Remove the `if (!deferred) return null;` early return so the button is **always rendered**.
- Always render a button; branch behavior inside `onClick`:
  - If `updateReady` → trigger waiting SW `skipWaiting` + `window.location.reload()`.
  - Else if `deferred` → call `deferred.prompt()`.
  - Else → open a popover with install instructions (iOS steps for Safari; Android/desktop fallback text: "Open this site in Chrome/Edge, then use browser menu → Install app / Add to Home Screen").
- Track `updateReady` via a small event bus (see #2). Label priority: Installed > Update Available > Install App.
- Detect platform (iOS vs Android vs desktop) to tailor popover content, but always show one unified button.

### 2. `src/pwa-register.ts`
- Use the `registerSW({ onNeedRefresh, onOfflineReady })` callbacks from `virtual:pwa-register`.
- On `onNeedRefresh`, dispatch a `window` custom event `dlax:pwa-update-ready` and stash the `updateSW` function on `window.__dlaxUpdateSW` so the button can call it.
- Keep existing preview/iframe/dev guards unchanged.

### 3. `src/routes/login.tsx`
- Add a **mobile-visible** `<InstallAppButton />` inside the mobile brand block (`lg:hidden`) so it appears above the login card on phones. Keep the existing desktop instance in the left panel.

No other files change. No manifest, vite config, service worker, or business logic changes.

## Notes / caveats (technical)

- The native install prompt only fires in Chromium after the browser's engagement heuristic and only on HTTPS with an active SW — so in some Android sessions the button will open the instructions popover instead of a native sheet. That's expected browser behavior; the button itself stays visible always as requested.
- Update detection only works on the deployed/published site (SW never registers in the Lovable editor iframe by design), so "Update Available" appears there, not in preview.
- iOS never exposes `beforeinstallprompt`; the instructions popover remains the only path Apple allows.
