## Daily Entry — Premium Visual Refresh

The current page reads "neutral but flat." This pass keeps the same content and logic, but raises the visual quality with a modern enterprise aesthetic — softer surfaces, layered depth, refined typography, and clearer hierarchy. Frontend-only changes to `src/routes/daily-entry.tsx` (and a few token additions in `src/styles.css`).

### 1. Page header — add presence without noise
- Two-line title block: small uppercase eyebrow `DAILY OPERATIONS` in `text-[11px] tracking-[0.14em] text-muted-foreground`, then `Daily Manpower Entry` at `text-[24px] font-semibold tracking-tight`, subtitle below in `text-[13px] text-muted-foreground`.
- Right side: `Template` and `Bulk Upload` as a single segmented group — joined buttons sharing one rounded border (`-space-x-px`), `h-9`, ghost styling, monochrome icons. Adds an "Actions" feel instead of two floating chips.
- Replace the thin `border-b` with a subtle gradient hairline:
  `bg-gradient-to-r from-transparent via-border to-transparent h-px`.

### 2. Toolbar — elevated, not boxy
- Wrap toolbar in a card with a soft layered look: `bg-card border border-border/70 rounded-xl px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_1px_rgba(15,23,42,0.03)]`.
- Date + Project triggers get a subtle inner surface: `bg-background hover:bg-muted/40 transition-colors`, leading icons in `text-muted-foreground`, value text in `text-foreground font-medium`.
- A faint vertical divider (`h-6 w-px bg-border/70`) between the date group and the project selector for rhythm.
- Right cluster: `Copy Previous Day` as `variant="ghost"` with `Copy` icon; `+ Add Row` as primary with a soft shadow (`shadow-sm hover:shadow-md transition-shadow`).
- Collapses cleanly under `sm` (stack, full-width controls).

### 3. Project context strip — quiet but informative
Replace the large empty band with a compact, content-rich strip directly above the table:

```text
┌───────────────────────────────────────────────────────────────────────┐
│  ● PROJECT  [P-001] Skyline Tower · Group A    │  TOTAL  128  / 12 rows │
└───────────────────────────────────────────────────────────────────────┘
```

- Container: `bg-gradient-to-r from-muted/40 to-muted/10 border border-border/60 rounded-lg px-4 py-3`.
- Left: a tiny status dot (`h-1.5 w-1.5 rounded-full bg-primary/80`), uppercase `PROJECT` label, monospace code pill (`bg-background border border-border/60 text-[11px] font-mono px-1.5 py-0.5 rounded`), name in `font-medium`, group in `text-muted-foreground`.
- Right: a vertical divider, then `TOTAL` label + headcount as `text-[15px] font-semibold tabular-nums` and "/ N rows" muted.
- Hidden entirely until a project is selected (so the page doesn't feel empty before).

### 4. Empty states — warm, intentional
- **No project selected** (current screenshot state): Replace the blank space with a centered, dashed-border card (`border-dashed border-border/70 rounded-xl bg-muted/20 py-16`), `ClipboardList` icon at `h-10 w-10 text-muted-foreground/50` inside a soft circular halo (`bg-muted/40 rounded-full p-4`), title `Select a project to begin`, subtitle `Choose a project above to load today's manpower entries.`, and a small `→ Use the project picker` muted hint pointing up.
- **No rows after project selected**: same card style with `Inbox` icon, message `No entries yet for this date`, and an inline `+ Add first row` primary button.

### 5. Table card — clean enterprise data look
- Card: `border border-border/70 rounded-xl overflow-hidden bg-card`.
- Header row: `bg-muted/40 border-b border-border/70`, labels `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground`, height `h-11`.
- Body rows: `h-12`, `border-b border-border/40` (last row no border), `hover:bg-muted/30 transition-colors`. No zebra.
- Selects/inputs inside cells: borderless ghost style on rest (`border-transparent bg-transparent hover:bg-muted/40 focus:bg-background focus:border-input`), so the table reads like a real spreadsheet rather than a stack of chunky form controls.
- Headcount cell: right-aligned, `tabular-nums font-medium`, with a subtle right border to separate from Remarks.
- Trash icon button: ghost, `text-muted-foreground hover:text-destructive`, only visible on row hover (sm+) for cleanliness.

### 6. Sticky save bar — refined
- `sticky bottom-0 border-t border-border/70 bg-background/85 backdrop-blur-md`.
- Left: small `Users` icon + `Total <b>128</b> · 12 rows · <muted>01 May 2026</muted>`.
- Right: `Save Entries` primary with `Save` icon and a soft ring on hover (`shadow-sm hover:shadow-md`).
- Adds a 1px top accent line (`bg-gradient-to-r from-transparent via-primary/30 to-transparent h-px absolute top-0`) for a premium edge.

### 7. Token additions in `src/styles.css`
Add two reusable utilities (no color changes to existing tokens):

```css
@layer utilities {
  .surface-elevated { box-shadow: 0 1px 2px oklch(0.15 0.03 250 / 0.04), 0 1px 1px oklch(0.15 0.03 250 / 0.03); }
  .hairline-x { background-image: linear-gradient(to right, transparent, var(--color-border), transparent); }
}
```

Used by header divider and toolbar shadow so the look is consistent and easy to reuse on other screens later.

### Files touched
- `src/routes/daily-entry.tsx` — JSX + classNames only.
- `src/styles.css` — add 2 utility classes (additive, no token changes).

### Out of scope
- No changes to data loading, save logic, bulk upload, or template generation.
- No changes to sidebar, theme palette, or other routes.
- No new dependencies.
