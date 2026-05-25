## DLAX Enterprise Theme & Branding Uplift

A full visual refresh giving DLAX a polished, enterprise SaaS look — anchored by the KPC logo and a "Navy Trust" base palette, with quick theme switching in the header.

---

### Logo handling (important)

The uploaded `kpc-logo_1.png` is a **white wordmark with an amber triangle accent** on a transparent background — i.e. it only reads correctly on **dark** surfaces.

Strategy:
1. Save the uploaded white logo as `src/assets/kpc-logo-white.png` — used on the navy sidebar, navy login panel, and dark-mode top bar.
2. Auto-generate a **dark variant** for light surfaces: invert the wordmark to deep navy (`#0f1b3d`) while keeping the amber accent. Saved as `src/assets/kpc-logo-dark.png`. Used on the light-mode top bar, light backgrounds, and favicon.
3. A small `<KpcLogo />` component picks the right variant based on the current `surface` prop (or theme mode).
4. PWA icons (`icon-192`, `icon-512`, `apple-touch-icon`) are regenerated as the amber accent on a navy rounded-square background so the app icon is recognizable on a home screen.

If you have an SVG version of the logo or a separate "KPC" + tagline lockup, drop it in later and I'll swap — the component centralizes the switch.

---

### 1. Design tokens (src/styles.css)

Replace the current generic blue palette with a structured enterprise token system:

- **Base palette (default — Navy Trust)**
  - Deep navy `#0f1b3d` → sidebar / primary surfaces
  - Mid navy `#1e3a5f` → primary brand
  - Steel blue `#3b6fa0` → interactive accents
  - Cool white `#e8edf3` → background tint, dividers
  - Amber `#e8a83a` → preserved as a secondary accent so the logo's amber arrow ties into the UI (used for highlights, badges, focus glows)
- Add semantic tokens: `--surface`, `--surface-elevated`, `--brand`, `--brand-foreground`, `--accent`, `--success`, `--warning`, `--danger`, `--info`, `--ring`, plus `--shadow-elevation-{1,2,3}` and `--gradient-brand`.
- Both light and dark variants for every token (dark mode = navy-tinted graphite, not pure black).

### 2. Multi-theme system

Add 4 switchable themes, each with light + dark variants, scoped via `data-theme` attribute on `<html>`:

| Theme | Use |
|---|---|
| `navy-trust` (default) | Enterprise / finance feel |
| `emerald-prestige` | Premium green + gold |
| `industrial-amber` | Slate + amber (closest tie to logo arrow) |
| `ocean-deep` | Modern infra/SaaS |

Implementation:
- New `src/hooks/use-theme.tsx` — `ThemeProvider` storing `{theme, mode}` in `localStorage` + applying `data-theme` and `class="dark"` on `<html>`.
- New `src/components/ThemeSwitcher.tsx` — compact header control: theme dropdown (color swatches) + light/dark toggle.
- Wrap app in `ThemeProvider` inside `src/routes/__root.tsx`.

### 3. Header (quick-switch location)

Promote the existing `<SidebarTrigger>` strip in `AppLayout.tsx` into a proper enterprise top bar:

```text
┌──────────────────────────────────────────────────────────────┐
│ ☰  [KPC] DLAX  ·  breadcrumb           🎨 ☀/🌙  👤 Name ▾  │
└──────────────────────────────────────────────────────────────┘
```

- Sticky top bar, hairline border, surface-elevated.
- Breadcrumb derived from current route.
- Right cluster: ThemeSwitcher, Light/Dark toggle, user menu (name, role, sign out).
- Logo variant on top bar follows light/dark mode.

### 4. Sidebar polish (`AppSidebar.tsx`)

- KPC white logo + "DLAX" wordmark + tagline at top on the navy sidebar (replace current icon).
- Tighter section labels (uppercase, tracked, muted).
- Active-item: amber left rail accent + subtle gradient background using `--brand` — visually ties to the logo's amber arrow.
- User block at bottom with avatar initials, name, role badge.
- Improved spacing & icon sizing for enterprise density.

### 5. Login page refresh (`routes/login.tsx`)

- Left panel: deep navy gradient + the white KPC logo prominent, DLAX wordmark beneath, three feature pills, QR install card restyled with new tokens.
- Right panel: card with refined typography, theme-tokenized inputs, focus rings using `--ring` (amber glow on focus for brand continuity).
- Remove hardcoded amber/slate Tailwind classes — switch to semantic tokens so the login auto-themes too.

### 6. Dashboard cards & tables (full enterprise polish)

- KPI cards: replace `stat-tint-*` utilities with a unified `<StatCard>` component — icon chip (brand-tinted), label, value, delta, sparkline slot. Subtle elevation, brand left-rail accent.
- Tables: hairline borders, sticky header, condensed row height option, right-aligned numeric columns, status pills using semantic tokens (success/warning/danger).
- Page headers: title + subtitle + actions cluster, consistent across all routes.

### 7. Typography

- Keep Inter (already loaded) but expand the scale: `text-display`, `text-h1..h4`, `text-body`, `text-caption`, `text-overline` as utility classes with proper tracking and weight pairings (enterprise = tighter tracking on display, regular on body).

### 8. Asset integration

- `src/assets/kpc-logo-white.png` (uploaded) — for dark surfaces
- `src/assets/kpc-logo-dark.png` (generated) — for light surfaces
- `src/components/KpcLogo.tsx` — picks the right variant
- Regenerate `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, favicon from the logo on a navy background.
- Update `manifest.webmanifest` `theme_color` to `#0f1b3d` and `__root.tsx` `theme-color` meta.

---

### Files touched / created

**Created**
- `src/hooks/use-theme.tsx`
- `src/components/ThemeSwitcher.tsx`
- `src/components/TopBar.tsx`
- `src/components/StatCard.tsx`
- `src/components/KpcLogo.tsx`
- `src/assets/kpc-logo-white.png`, `src/assets/kpc-logo-dark.png`

**Edited**
- `src/styles.css` — new token system + 4 theme blocks + dark variants
- `src/routes/__root.tsx` — ThemeProvider, updated theme-color meta
- `src/components/AppLayout.tsx` — mount TopBar
- `src/components/AppSidebar.tsx` — logo, polish, user block
- `src/routes/login.tsx` — token-driven styling, white logo on navy panel
- `src/routes/index.tsx` — dashboard StatCards
- `src/routes/reports.tsx`, `daily-entry.tsx`, `approvals.tsx`, `users.tsx`, `masters.*.tsx` — adopt page header pattern + table styling tokens
- `public/manifest.webmanifest` — theme color
- `public/icon-*.png`, `apple-touch-icon.png` — regenerated from logo on navy

### Out of scope

- No backend, RLS, schema, or business-logic changes.
- No new features — purely visual + theming infrastructure.
