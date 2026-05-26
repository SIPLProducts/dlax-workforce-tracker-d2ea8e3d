# Sticky table headers on Daily Entry + master screens

## Goal

Keep the page title bar (already sticky) AND the table's column-header row visible while the user scrolls through table rows. Only the data rows should scroll.

## Affected screens

- Daily Entry — `src/routes/daily-entry.tsx`
- Projects (Master) — `src/routes/masters.projects.tsx`
- Category of Labour ("Departments") — `src/routes/masters.departments.tsx`
- Categories — `src/routes/masters.categories.tsx`
- Approval Settings — `src/routes/masters.approvals.tsx`
- Project Permissions / Assignments — `src/routes/masters.assignments.tsx`

## Approach

The app's single scroll container is `<main>` in `AppLayout` (`overflow-auto`). The `PageHeader` is already `sticky top-14`. For tables we'll make the `<thead>` row sticky within that same scroll container, positioned just below the TopBar (h-14 = 56px) + PageHeader (~64px) stack.

Concretely, in each screen:

1. Add `className="sticky top-[120px] z-[5] bg-card shadow-[0_1px_0_0_hsl(var(--border))]"` to the `<TableHeader>` (or per `<TableHead>` cell, depending on what the shadcn `Table` allows for sticky). For the shadcn table, `<thead>` sticky works; if needed we'll apply `sticky` to each `<TableHead>` cell instead so the background covers properly.
2. Ensure the wrapping `Card`/`CardContent` does NOT set `overflow-hidden` on the vertical axis (it currently uses `p-0`, which is fine). No fixed-height inner scroller is introduced — we keep the page-level scroll model.
3. For Daily Entry's spreadsheet grid (which has grouped header rows + a horizontally scrolling table), apply `sticky top-[120px]` to every header row of `<TableHeader>` so both the group row and the column row stick together. Horizontal scroll inside the table wrapper remains unchanged.

## Technical notes

- Sticky offset = TopBar (56px) + PageHeader (~60–64px). Using `top-[120px]` keeps the column header flush under the page title bar on desktop. On mobile the PageHeader hides its subtitle and is slightly shorter — `top-[112px]` is acceptable; we'll pick `top-[120px]` as a safe single value that visually works in both because the PageHeader has a solid background that masks any small overlap.
- Add `bg-card` (or `bg-background`) to the sticky header so scrolling rows don't bleed through.
- Add a subtle bottom border via Tailwind `shadow-[0_1px_0_0_hsl(var(--border))]` or rely on the existing `border-b` on `<TableHead>`.
- Use a low `z-index` (`z-[5]`) so the PageHeader (`z-10`) still wins where they meet.
- No changes to business logic, queries, or component APIs.

## Out of scope

- No changes to `AppLayout`, `TopBar`, or `PageHeader`.
- No new scroll containers or fixed heights — the page continues to scroll as one document, the thead just sticks.
- Other list/table screens (Users, Approvals, Reports, Contractors) are untouched per the request.
