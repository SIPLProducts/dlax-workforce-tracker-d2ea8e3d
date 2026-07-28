## Goal

Keep the existing QR install card exactly as-is, and **add** a native "Install" button next to it that triggers the browser's install prompt directly when clicked.

## Behavior

- **Chromium (Chrome/Edge/Android)**: capture `beforeinstallprompt`, store the event; button click calls `prompt()` → native install dialog.
- **iOS Safari**: no install event exists; button opens a small popover with "Tap Share → Add to Home Screen" steps.
- **Already installed** (`display-mode: standalone` or `appinstalled` fired): show a disabled "Installed" state.
- **Unsupported desktop browsers**: button hidden.

## Changes

### 1. New file `src/components/InstallAppButton.tsx`
- `useEffect` registers listeners for `beforeinstallprompt` (preventDefault + store event) and `appinstalled` (mark installed).
- Detects iOS via UA and standalone via `matchMedia('(display-mode: standalone)')` / `navigator.standalone`.
- Renders a compact button styled to match the existing glass card (indigo/amber accents, Download icon).
- iOS branch renders the same button; click opens a lightweight popover with instructions.

### 2. `src/routes/login.tsx`
- Keep the existing QR "Install on Mobile" card unchanged.
- Add `<InstallAppButton />` directly below (or beside) that card inside the same bottom stack (around line 229–245 area).
- No other content or styles touched.

## Notes

The `beforeinstallprompt` event only fires when the browser considers the site installable. Chromium typically requires a registered service worker for the prompt to be offered. This project intentionally has no app-shell service worker (per PWA rules), so on Chrome desktop the button may stay hidden until a service worker is added. iOS instructions and the QR card continue to work regardless. Say the word if you also want the guarded `vite-plugin-pwa` service worker enabled so Chromium reliably offers the prompt.

## Technical section

- Added: `src/components/InstallAppButton.tsx` (client-only, no server code).
- Edited: `src/routes/login.tsx` — one import + one JSX line inside the existing bottom section.
- No changes to manifest, routes, DB, or server functions.
