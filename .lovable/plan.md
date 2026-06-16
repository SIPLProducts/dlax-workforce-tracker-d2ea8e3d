## Problem
The Summary Report table has two issues when scrolling:
1. **Header scrolls away** — the `<TableHeader>` is not fixed; it disappears when scrolling down through long project lists.
2. **Alignment drift** — the outer wrapper and the shadcn `Table` component both define `overflow-x-auto`, creating nested scrollable containers that can cause column misalignment during scroll.

## Fix
Replace the shadcn `<Table>` usage inside `SummaryTab` with a plain `<table>` wrapped in a single scrollable container that handles both horizontal and vertical overflow.

### Changes in `src/routes/reports.tsx` (SummaryTab JSX, ~lines 983–1058)

1. **Remove the outer `overflow-x-auto` div** and replace it with a container that has both vertical and horizontal scroll, plus a max height:
   ```
   <div className="rounded-md border max-h-[60vh] overflow-auto">
   ```

2. **Render a native `<table>` instead of shadcn `<Table>`** so we control the wrapper and avoid nested `overflow-x-auto`.

3. **Make `<thead>` sticky at the top:**
   ```
   <thead className="sticky top-0 z-20 bg-background">
   ```

4. **Make the first two header cells doubly sticky** (top + left) with a higher z-index so they stay visible over both row data and the header bar:
   - S.No header: `sticky left-0 top-0 z-30 bg-background`
   - Project Name header: `sticky left-14 top-0 z-30 bg-background`

5. **Keep data row cells as they are** (`sticky left-0 z-10` and `sticky left-14 z-10`) so the first two columns remain pinned during horizontal scroll.

6. **Preserve all existing data logic** — columns, rows, totals, and null handling stay unchanged.

### Result
- Scrolling down keeps the header row fixed at the top.
- Scrolling right keeps the first two columns fixed at the left.
- A single overflow container eliminates nested-scroll alignment drift.
- Only the data rows scroll vertically; the header remains visible.