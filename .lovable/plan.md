## Polish the Summary / Week-wise matrix table UI

Only visual/CSS changes to the "KPC Projects Limited" week-wise matrix in `SummaryTab` (`src/routes/reports.tsx`, lines ~775-853). Data, columns, weekly averages, month totals, sticky behavior, and export are untouched.

### Container
- Upgrade wrapper from `rounded-md border` to a soft card: `rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden`.
- Header strip: `px-5 py-3 bg-muted/40 border-b border-border/60`. Title `text-base font-semibold tracking-tight`. Subtitle `text-xs text-muted-foreground` prefixed with a small `CalendarDays` icon.

### Header row (thead)
- `thead` gets a subtle gradient + blur: `bg-linear-to-b from-muted/60 to-muted/30 backdrop-blur` and a firmer bottom border.
- Label styling: `text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80`, `px-3 py-2.5`, right-aligned for numeric columns.
- Day headers render two-line: day-of-month bold on top, month abbreviation muted below (same `c.date` value, just split visually). Weekend day columns get a slightly darker cell tint.
- `Avg W-*` columns: softer tint `bg-accent/10`, italic label.
- `Month Total` column: `bg-primary/10 text-primary font-semibold` with `border-l border-primary/20`.

### Body rows
- Row height `h-11`, zebra `[&>tr:nth-child(even)]:bg-muted/20`, hover `hover:bg-primary/5 transition-colors`.
- S.No: circular chip `inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground`.
- Project name cell: code shown as a pill `inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground mr-2`; name in `font-medium text-foreground` with `truncate` + `title` for full text.
- Number cells: `px-3 tabular-nums`; zero rendered muted (`text-muted-foreground/40`), non-zero in `text-foreground`, null stays em-dash muted.
- Sticky S.No and Project columns: keep sticky, use `bg-background`, add right divider with subtle shadow `shadow-[1px_0_0_0_hsl(var(--border))]` so they lift above scrolling columns.

### Grand Total row
- Elevated bar: `bg-linear-to-r from-muted/70 via-muted/50 to-muted/70 border-t-2 border-border font-semibold`.
- Label "Grand Total" in `uppercase tracking-wide text-xs`.

### Empty / loading states
- Center message in a `py-12` block with a muted `Users`/`CalendarDays` icon above and improved copy styling.

### Scroll affordance
- Wrap the scroll container so the sticky column has a soft right shadow only when horizontally scrolled (pure CSS via `[mask-image]` or the shadow above — no JS).

### Out of scope
- No changes to `matrix` computation, columns, averages, totals, filters, or XLSX/CSV export.
- No changes to KPI cards above the table.
- No new dependencies; use existing Tailwind tokens + lucide icons already imported.
