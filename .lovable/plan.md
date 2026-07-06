## Restyle the Summary matrix table to match the Excel reference

Visual-only changes to the "KPC Projects Limited" matrix in `SummaryTab` (`src/routes/reports.tsx`, ~lines 775-853). Data, columns, computation, sticky behavior, and XLSX/CSV export stay exactly as-is.

Reference cues taken from the uploaded Excel screenshot:
- Solid, single-weight grid lines around every cell (spreadsheet look).
- Bold, centered header labels with the S.No / Project Name columns treated as tall left-aligned cells.
- Average / Month-total columns tinted a warm peach so they stand out from data columns.
- Generous cell padding, uniform column widths, tabular numbers.

### Changes

**Container**
- Replace `rounded-md border` with `rounded-lg border border-border bg-card shadow-sm overflow-hidden`.
- Header strip: `px-5 py-3 border-b bg-muted/40`, title `text-base font-semibold tracking-tight`, subtitle `text-xs text-muted-foreground` with a small `CalendarDays` icon prefix.

**Table shell**
- Wrap scroller: `relative max-h-[65vh] overflow-auto`.
- Table: `w-full text-sm border-separate border-spacing-0` so every cell can draw its own border cleanly.
- Give every `th`/`td` these base classes via a shared const: `border-r border-b border-border/70 px-3 py-2 align-middle`. Last column drops the right border via `last:border-r-0`.

**Header (thead)**
- Two visual tiers using existing single header row: `bg-muted/60 text-foreground` for all header cells; `font-semibold text-xs uppercase tracking-wide`.
- S.No: `w-14 text-center`. Project Name: `min-w-[240px] text-left`.
- Day headers: centered, format kept as `d/M` but rendered in two lines — day number bold on top (`text-sm`), month muted below (`text-[10px] text-muted-foreground`). Keeps existing data.
- Avg columns: `bg-[oklch(0.94_0.05_55)] text-foreground` (soft peach, matches reference). Add `border-l-2 border-border` on the leftmost avg cell of each week block for visual grouping.
- Month Total column: `bg-[oklch(0.9_0.08_55)] text-foreground` (deeper peach) with `border-l-2 border-border`.

**Body rows**
- Row height via `py-2.5` on cells. Zebra `[&>tr:nth-child(even)>td]:bg-muted/15`.
- Hover: `hover:[&>td]:bg-primary/5 transition-colors`.
- S.No cell: `text-center tabular-nums text-muted-foreground`.
- Project Name cell: code as monospace muted pill `inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground mr-2`; name in `font-medium text-foreground`. `whitespace-nowrap` stays.
- Number cells: `text-right tabular-nums px-3`. Zero shown in `text-muted-foreground/50`; non-zero in `text-foreground`. Null continues to render `—` in `text-muted-foreground/50`.
- Avg cells: same soft peach `bg-[oklch(0.97_0.03_55)]`. Month Total cells: `bg-[oklch(0.94_0.06_55)] font-semibold text-foreground`. Both keep left-emphasis border to match header grouping.

**Sticky columns**
- Keep sticky positions for S.No (`left-0 w-14`) and Project Name (`left-14 min-w-[240px]`).
- Sticky cells always paint an opaque background (`bg-card`), plus `shadow-[1px_0_0_0_hsl(var(--border))]` on the Project Name column to visually pin the divider even when scrolled.
- Sticky header cells: `sticky top-0 z-30`, background `bg-muted/70` so they stay readable over data.

**Grand Total row**
- `[&>td]:bg-muted/60 [&>td]:font-semibold [&>td]:border-t-2 [&>td]:border-border`.
- Label "Grand Total" left-aligned in the sticky Project Name cell, uppercase tracking-wide `text-xs`.
- Number cells: `text-foreground tabular-nums`. Month Total total cell keeps deeper peach + bold.

**Empty / loading states**
- Center block `py-12 text-center`. Loading: small spinning `Loader2` icon (`h-5 w-5 animate-spin text-muted-foreground/60`) + "Loading…" muted. Empty: `Users` icon (`h-8 w-8 text-muted-foreground/40`) above "No approved data in selected range" in `text-sm text-muted-foreground`.
- Rendered inside a single `td` with `colSpan={2 + matrix.columns.length}` (unchanged).

### Out of scope
- No changes to `matrix` computation, week grouping, filters, KPI cards, or exports.
- No new dependencies. Reuse Tailwind tokens and lucide icons already imported in the file (`CalendarDays`, `Users`; add `Loader2` from the existing `lucide-react` import list).
- No structural markup changes beyond swapping classes and splitting the day header into two lines.
