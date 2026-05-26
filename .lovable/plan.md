# Login — Microsoft Sign-in Style

Replace the current rich Midnight Indigo design with a clean, flat Microsoft-style sign-in. No gradients, no glassmorphism, no animated mesh — just white surface, sharp typography, and a single Microsoft-blue accent.

## Visual direction

- **Background:** pure white `#FFFFFF` (full viewport). No split, no panel art on desktop — Microsoft uses a single centered card.
- **Card:** rectangular (NOT rounded), thin 1px border `#E5E5E5`, soft subtle shadow `0 2px 6px rgba(0,0,0,0.10)`, fixed width 440px, generous padding (44px), left-aligned content.
- **Top of card:** small KPC logo (24px), then "DLAX" wordmark in Segoe-style sans-serif (use system `Segoe UI` font stack — falls back cleanly).
- **Heading:** "Sign in" — 24px, weight 600, near-black `#1B1B1B`, left-aligned.
- **Subhead:** "to continue to DLAX" — 15px, `#605E5C`.
- **Inputs:** flat, NOT rounded. White background, no border on sides/top, only a 1px bottom border `#605E5C` (Microsoft underline-style). On focus, bottom border becomes 2px Microsoft blue `#0067B8`. No icons inside inputs. Label sits above as plain text.
- **Primary button:** square corners, solid `#0067B8`, hover `#106EBE`, white text "Sign in", weight 600, 32px height-ish (use 40), positioned bottom-right of the card (Microsoft's signature "Next →" alignment). No gradient, no shadow on the button.
- **Secondary link:** "Can't access your account?" / "Contact your administrator" in `#0067B8` text-link styling under the form, left-aligned.
- **Footer (outside card, bottom-right of viewport):** small links row "Terms of use · Privacy & cookies · …" muted gray `#605E5C`, 12px.
- **Top-left of viewport (outside card):** KPC mark only, small, like Microsoft's logo placement.

## Mobile

- Same card, full width minus 24px gutters, same flat treatment. QR install row appears below card in the same flat style (thin border, no shadow).

## Tokens / scope

- Everything stays inside `src/routes/login.tsx`. No theme token changes.
- Use inline `style` for the exact Microsoft colors (`#0067B8`, `#1B1B1B`, `#605E5C`, `#E5E5E5`) — they're brand-specific, not theme tokens.
- Use `font-family: 'Segoe UI', system-ui, -apple-system, sans-serif` on the card root so Windows users get the real Segoe rendering.
- Keep `useAuth`, form submit, password show/hide, loading spinner, QR URL — unchanged.

## Removed from current design

- Animated mesh background, gradient orbs, grid overlay.
- Left brand panel with constellation SVG.
- Glassmorphism, backdrop-blur, glow shadows.
- Gradient wordmark, amber spark line, gradient CTA button.

## Files

- `src/routes/login.tsx` — full visual rewrite; logic preserved.

## Verification

- `/login` desktop: white viewport, single centered rectangular card with thin border, "Sign in" heading, underline-only inputs, square blue button bottom-right of card.
- Focused input shows 2px blue underline.
- Mobile: card fills width with comfortable margins, QR row below, footer links readable.
- Sign-in submit still works.
