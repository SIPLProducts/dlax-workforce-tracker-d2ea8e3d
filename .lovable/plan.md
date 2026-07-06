
## Fix sticky S.No + Project Name columns in Summary matrix

**File:** `src/routes/reports.tsx` (lines ~783–899, table only)

### Root cause
Sticky left cells use translucent tokens (`bg-muted/20`, `bg-card` over a themed surface, `bg-muted/70`). During horizontal scroll, day/avg/month cells slide underneath and bleed through the sticky S.No and Project Name cells because the backgrounds aren't opaque. The header row has the same issue on vertical scroll.

### Changes (visual/structural only — no data or logic changes)

1. **Opaque sticky backgrounds**
   - Introduce two solid, theme-aware helpers (inline classes only, no new tokens):
     - Sticky header cells: `bg-background` (fully opaque) instead of `bg-muted/70`. Add a subtle inner tone via a wrapping `::after` isn't needed — use `bg-secondary` if we want the muted look, but solid.
     - Sticky body cells: replace `rowBg` (`bg-card` / `bg-muted/20`) on the sticky `<td>`s with solid `bg-background` for odd rows and `bg-muted` (solid) for zebra rows. Keep the non-sticky cells using the existing translucent `rowBg` so zebra striping stays visible across scrollable area.
     - Grand Total sticky cells: use solid `bg-secondary` instead of `bg-muted/60`.

2. **Z-index layering (locked order)**
   - Top-left corner header cells (S.No, Project Name in `<thead>`): `z-40` (already correct).
   - Scrolling column headers (day/avg/month): `z-30` (already correct).
   - Sticky left body cells: bump from `z-10` to `z-20` so they always sit above scrolling body cells (`z-0`) and below headers.
   - Grand Total sticky cells: `z-20` to match.

3. **Sticky offsets & sizing**
   - Keep `left-0` for S.No (`w-14`) and `left-14` for Project Name (`min-w-[240px]`).
   - Ensure `border-separate border-spacing-0` stays (required for sticky borders).
   - Preserve the right-edge separator on Project Name via `shadow-[1px_0_0_0_hsl(var(--border))]` on both header and body cells (already present); keep `group-hover:bg-primary/5` but apply it as an overlay class that still respects opacity — since bg is now solid, hover works cleanly.

4. **Scroll container**
   - Keep single `div.relative.max-h-[65vh].overflow-auto` wrapper (one scroll area handles both axes; sticky headers pin top, sticky cols pin left).
   - Add `isolate` to the wrapper so sticky z-index stacking is self-contained and doesn't compete with sibling cards.

### Out of scope
No changes to `matrix` computation, column definitions, KPI cards, filters, week-wise table, or CSV/XLSX export. Purely CSS class adjustments on the existing table markup.
