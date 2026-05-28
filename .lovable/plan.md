## Fix Login Right Panel Background

The right side of the login screen currently uses pure black (`#0A0A1A`) with indigo/violet mesh blobs, which clashes against the navy gradient on the left (`#0A1530 → #14306B`). The seam between the two panels is very visible.

### Change

In `src/routes/login.tsx`, on the right login panel container:

- Replace `bg-[#0A0A1A]` with a navy gradient that continues from where the left panel ends, e.g.:
  - `linear-gradient(135deg, #14306B 0%, #0F1F47 55%, #0A1530 100%)` (mirror of the left, so the seam blends).
- Tone down the mesh blobs so they read as subtle ambient light, not bright spotlights on black:
  - Reduce opacities (e.g. indigo `0.7 → 0.35`, violet `0.6 → 0.3`, amber `0.4 → 0.2`).
  - Lower grid overlay opacity from `0.06` to `0.04`.
- Keep the white glass login card, the animations, and all form logic unchanged.

### Result

Both halves share the same deep-navy palette; the right side feels like a continuation of the left rather than a separate black panel, while the white card still pops as the focal point.

### Out of scope

- No changes to the left panel, the login form, auth flow, or any other route.
- No new assets or dependencies.
