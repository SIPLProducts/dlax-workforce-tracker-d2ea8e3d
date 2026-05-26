# Login Screen Redesign

Refresh `src/routes/login.tsx` only — no behavior, auth, or routing changes. Pure visual / presentational rework matching the requested split-screen enterprise aesthetic.

## Visual direction

**Left panel (≈45% on `lg`, hidden on mobile)**
- Deep midnight-blue gradient: `#0A1530 → #0F1F47 → #14306B` (top-left → bottom-right).
- Abstract geometric "connectivity" line art as an SVG layer: thin 1px white/10% lines forming a node-and-edge constellation, plus 2–3 soft amber glow dots at intersections. Subtle, decorative, non-distracting.
- KPC logo top-left.
- Centered brand block:
  - `DLAX` wordmark in large, tight, crisp display weight (Inter 700, tracking-tight).
  - Tagline "Daily Labour Attendance & Tracking" in small uppercase, wide tracking, slate-300.
  - One short value sentence below in slate-300/80.
- Bottom: a single compact "Install on mobile" row with the QR + 2-line copy, sitting on a faint white/5 surface.
- Footer copyright in slate-500, 11px.
- Remove the current 3-feature stacked cards (replaced by the cleaner brand + line-art composition).

**Right panel (login card)**
- Background: very light neutral (`bg-muted/30`) so the card floats.
- Card: pure white (light) / `bg-card` (dark), `rounded-2xl`, generous `p-10`, no visible border, ambient shadow using layered soft shadows (e.g. `shadow-[0_30px_80px_-20px_rgba(15,31,71,0.18),0_8px_24px_-12px_rgba(15,31,71,0.10)]`).
- Heading "Welcome back" (text-2xl, semibold) + muted subhead.
- Inputs:
  - Borderless, `bg-slate-50` (light) / `bg-white/5` (dark), `rounded-xl`, `h-12`.
  - Focus state: `ring-2 ring-primary/60` + background turns white, smooth `transition`.
  - Icon (User / Lock) inset left, eye toggle inset right for password.
  - Helper text muted, 12px.
- Primary button: full width, `h-12`, `rounded-xl`, primary background, subtle gradient sheen on hover, loading spinner unchanged.
- Footer line: "Don't have an account? Contact your administrator." muted, centered.

**Mobile (< lg)**
- Single-column. Top: small KPC logo chip + DLAX wordmark on a slim midnight-blue band (rounded-b-3xl) for brand presence without the full left panel.
- Same login card centered below with comfortable margins.
- QR install row appears below the card as today, restyled to match (rounded-xl, soft shadow, no hard border).

## Tokens / styling rules

- Use semantic Tailwind tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `ring-primary`, etc.). Custom hex values only inside the left panel gradient and the SVG line-art (brand-specific midnight blue & amber accent) — these are visual brand assets, not theme tokens.
- Inter is already the default sans; no font swap needed.
- Works in both light and dark mode (right panel adapts via tokens; left panel is always dark by design).

## Out of scope

- No changes to `useAuth`, form submit, `signInWithUserId`, routing, or QR install URL.
- No new components extracted unless the file becomes unwieldy — keep everything in `src/routes/login.tsx`.
- No new dependencies.

## Files

- `src/routes/login.tsx` — full visual rewrite of the JSX + inline SVG line-art; logic preserved verbatim.

## Verification

- Visit `/login` on desktop (≥1112px): split layout renders, line art visible, card floats with soft shadow, focus ring appears on inputs.
- Resize to mobile: left panel hides, top brand band + centered card + QR row stack cleanly.
- Submit still works (unchanged handler).
