## Daily Entry — Professional UI Polish

Frontend-only refinements to `src/routes/daily-entry.tsx`. No business logic, state, or backend changes.

### 1. Page header (tighter, more executive)
- Remove the icon tile next to the title; keep the icon only in the sidebar.
- Title `text-[22px] font-semibold tracking-tight`, subtitle `text-[13px] text-muted-foreground`.
- Move `Template` and `Bulk Upload` into a single right-aligned button group (`size="sm"`, `h-9`, neutral outline, monochrome icons at `h-3.5 w-3.5`).
- Replace the full-width `border-b` under the header with a subtle `border-b border-border/60` that spans the content column only.

### 2. Unified toolbar (replaces the big filter card + action row)
Convert the oversized gradient filter card into a single slim toolbar bar:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [📅 01 May 2026]  [Project ▾ Select project        ]   [Copy prev] [+ Add row] │
└──────────────────────────────────────────────────────────────────────┘
```

- `bg-card border border-border rounded-lg px-3 py-2` — no gradient, no shadow.
- Inline labels removed; use placeholder text + leading icon inside each control.
- Date and Project triggers `h-9`, equal visual weight.
- Action buttons right-aligned with `ml-auto`; only `+ Add row` is `variant="default"`, `Copy Previous Day` becomes `variant="ghost"` with icon.
- Stack vertically below `sm` breakpoint.

### 3. Project context strip (replaces 4 colored stat tiles)
Replace `stat-tint-blue/purple/teal/green` chips with one neutral inline strip directly above the table:

```text
PROJECT  [CODE] Project Name · Group         •         TOTAL  128 across 12 rows
```

- Single row, `bg-muted/30 border border-border/60 rounded-md px-4 py-2.5 text-sm`.
- Left side: monospace code in a small `bg-background border` pill, then name, then group as muted text.
- Right side: total headcount as `text-foreground font-semibold tabular-nums` followed by row count in muted text.
- Collapses to two lines on mobile; no colored backgrounds anywhere.

### 4. Empty / no-project state
- Keep the existing empty card but remove the circular muted icon background; use a plain `ClipboardList` icon at `h-8 w-8 text-muted-foreground/60` centered above the message.
- Reduce vertical padding from `py-14` → `py-12`; tighten copy spacing.

### 5. Table card refinements
- Drop `shadow-sm`; use `border border-border rounded-lg` only.
- `TableHeader` row: `bg-muted/40`, `text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`, `h-10`.
- Row hover: `hover:bg-muted/30`; remove any zebra striping.
- Tighten cell padding to `py-2.5`; numeric inputs right-aligned with `tabular-nums`.

### 6. Sticky save bar
- Keep sticky behavior but simplify: `border-t bg-background/95 backdrop-blur-sm` (no heavy shadow, no gradient).
- Left: muted summary `Total: 128 · 12 rows`. Right: `Save Entries` primary button only.

### Files touched
- `src/routes/daily-entry.tsx` — JSX + classNames only. No handlers, queries, or types modified.

### Out of scope
- No changes to bulk upload, template generation, save logic, or data model.
- No changes to the sidebar, theme tokens, or other routes.
