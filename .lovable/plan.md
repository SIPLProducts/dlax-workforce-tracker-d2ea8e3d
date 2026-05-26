# Login Page — Premium Redesign

Make the login feel rich, modern, and enterprise-premium. Replace the current flat ice-blue right panel and static left panel with a cohesive dark Midnight Indigo composition, glassmorphism card, animated gradient mesh background, and subtle motion accents.

## Direction

- **Palette (Midnight Indigo):** `#0A0A1A` base, `#141432` mid, `#1E1E5A` deep accent, `#4F46E5` primary glow, with `#FBBF24` amber spark for brand highlights.
- **Typography:** Inter (already loaded) — keep, tighten tracking on display headings.
- **Layout:** Full-bleed split (≈55/45 on `lg`). Left = brand canvas. Right = glass login card centered on a richly textured midnight background — not flat slate.

## Visual changes (right panel — the main complaint)

Replace the flat `#E8F1F8` slate background with a layered midnight composition:

1. **Background:** dark midnight base + animated conic/radial gradient mesh (blurred indigo + violet + amber blobs, very large, slow drift via CSS `@keyframes`).
2. **Login card:** glassmorphism — `bg-white/[0.04]`, `backdrop-blur-2xl`, 1px white/10 border, `rounded-3xl`, dual-layer ambient shadow + inner highlight. Floats above the mesh.
3. **Inside the card:**
   - Small KPC mark + "DLAX" wordmark above heading on mobile (replaces current band).
   - Heading "Welcome back" in white, semibold, tracking-tight; subhead in slate-400.
   - Inputs: dark glass — `bg-white/[0.06]`, 1px white/10 border, `rounded-xl`, `h-12`, icon in indigo-300, focus ring `ring-2 ring-indigo-400/70` + subtle outer glow.
   - Show/hide password eye in slate-400.
   - Primary CTA: gradient button `from-indigo-500 to-violet-500`, white text, soft `shadow-indigo-500/40` glow, micro lift on hover.
   - Footer line: muted slate-400.
4. **Decorative:** thin amber spark line under the heading, animated pulse dot on the brand logo.

## Visual changes (left panel)

Keep the brand panel but lift it:

- Replace the current line-art with a denser, more refined SVG constellation (more nodes, varied opacities, 2–3 amber pulse dots with `animate-ping`).
- Add a soft animated indigo glow orb behind the wordmark.
- Bigger DLAX wordmark with subtle gradient text (`from-white to-indigo-200`).
- Brand band at bottom with the QR install card already there — restyle to match new glass aesthetic.

## Mobile (< lg)

- Hide left panel; entire viewport gets the same animated midnight mesh background.
- Logo + DLAX wordmark stack above the glass card (no separate band).
- QR card below the login card uses the same glass treatment.

## Tokens / implementation

- All new visuals are scoped to `src/routes/login.tsx`. No global theme changes.
- Use Tailwind utility classes; add a small `<style>` block (or inline keyframes via Tailwind arbitrary values) for the slow gradient drift (`@keyframes meshDrift`).
- No new dependencies. No changes to auth, form submit, routing, or QR URL.

## Out of scope

- `useAuth`, `signInWithUserId`, navigation, validation logic, QR URL.
- Global design tokens in `src/styles.css`.
- Other routes / layouts.

## Files

- `src/routes/login.tsx` — full visual rewrite (JSX + inline keyframes only).

## Verification

- `/login` desktop ≥1112px: split layout, animated midnight mesh on the right, glass login card with focus glow on inputs.
- Resize to mobile: single column, mesh background fills viewport, glass card centered with QR card below.
- Submit still works; loading spinner unchanged.
