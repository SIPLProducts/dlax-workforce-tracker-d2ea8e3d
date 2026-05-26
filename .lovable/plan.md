# Login Screen — Mesh Gradient Redesign

Replace the current split-screen layout in `src/routes/login.tsx` with a full-bleed mesh-gradient background and a single floating glass login card. Visual-only change; auth logic, routes, and the `signInWithUserId` call stay untouched.

## Visual direction

**Background (full viewport)**
- Base diagonal gradient navy → slate → warm off-white:
  `linear-gradient(105deg, #0B1A3A 0%, #1B2A4E 28%, #4B5A75 55%, #B9BFCC 78%, #F2EFEA 100%)`.
- Layered mesh blobs (large blurred radial gradients) absolutely positioned, low opacity, for the soft "mesh" feel:
  - top-left deep indigo `#1E2F66` blob, `blur-3xl`
  - mid-left slate `#2E4368` blob
  - right-side warm cream `#EEE8DC` blob
  - subtle amber highlight `#F5C56B` near the card for warmth
- A faint grain/noise overlay via an inline SVG `feTurbulence` mask at ~4% opacity to kill banding.

**Layout**
- Single full-screen flex container. Card positioned center on mobile, right-of-center on desktop (`lg:justify-end lg:pr-[10vw]`).
- Small brand mark (KPC logo + "DLAX" wordmark) floats top-left over the dark side of the gradient, white text.
- Bottom-left small footer line in white/60. Bottom-right small "Install on mobile" QR pill, glass-styled.

**Login card (glass)**
- ~`w-[420px]`, `rounded-3xl`, `p-9`.
- `bg-white/70 dark:bg-white/10`, `backdrop-blur-2xl`, `border border-white/40 dark:border-white/15`.
- Ambient shadow: `shadow-[0_30px_80px_-20px_rgba(11,26,58,0.35),0_8px_24px_-12px_rgba(11,26,58,0.20)]`.
- Heading "Welcome back" (text-2xl, semibold, slate-900) + muted subhead.
- Inputs: borderless, `bg-white/60`, `rounded-xl`, `h-12`, with leading icon. Focus → solid white + `ring-2 ring-primary/60`.
- Password eye toggle preserved.
- Primary button: full width, `h-12`, `rounded-xl`, deep navy `#0F1F47` background with subtle gradient sheen on hover, white label.
- "Don't have an account?" muted helper below.

**Mobile (< lg)**
- Same background. Card centered with comfortable side padding.
- Brand mark stacks above the card instead of floating top-left.
- QR pill moves below the card.

## Tokens / styling rules

- Card chrome and form controls use semantic tokens where possible (`text-foreground`, `text-muted-foreground`, `ring-primary`).
- Background gradient colors are brand-specific atmospheric assets — kept as inline hex / style values, not theme tokens.
- Works in light mode primarily; dark mode falls back gracefully (card switches to translucent dark glass via `dark:` classes).

## Out of scope

- No changes to `useAuth`, `signInWithUserId`, routing, QR URL, or any business logic.
- No new dependencies or extracted components — everything stays in `src/routes/login.tsx`.

## Files

- `src/routes/login.tsx` — full visual rewrite (background layers + glass card + repositioned brand/QR).

## Verification

- `/login` at 1112×674: mesh gradient spans full screen, card floats right-of-center with visible glass blur, focus rings appear on inputs, submit still works.
- Resize to mobile: card centers, brand stacks above, QR pill stacks below, no overflow.
