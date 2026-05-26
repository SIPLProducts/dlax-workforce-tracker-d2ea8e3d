# Fix sticky-header overlap on Daily Entry + master pages

## Problem (visible in screenshot)

1. The PageHeader is ~144px tall on desktop (TopBar 56 + PageHeader padding + title + subtitle + border). My current sticky `top-[112px]` sticks the table headers **inside** the PageHeader, overlapping the page title.
2. On the Daily Entry spreadsheet, the mirrored horizontal scrollbar inside `TableWithTopScroll` is `sticky top-0 z-30`, so it floats above the TopBar.

## Fix

### Sticky offsets (responsive)

Use `top-[112px] md:top-[144px]` so the column header sits flush under PageHeader on both breakpoints.

### Files to update

- `src/routes/masters.projects.tsx`
- `src/routes/masters.categories.tsx`
- `src/routes/masters.departments.tsx`
- `src/routes/masters.approvals.tsx`
- `src/routes/daily-entry.tsx` (Saved Entries table)

Change the `TableHeader` className from
`[&_th]:top-[112px]` → `[&_th]:top-[112px] md:[&_th]:top-[144px]`.

### Daily Entry spreadsheet (`daily-entry.tsx`)

- Row 1 `<th>` sticky `top-[112px] md:top-[144px]`
- Row 2 `<th>` sticky `top-[148px] md:top-[180px]` (row 1 height ~36px)
- Remove the `sticky top-0 z-30` from the `TableWithTopScroll` mirrored top scrollbar — keep it in normal flow so it doesn't cover the TopBar/PageHeader. The bottom div already shows its own horizontal scrollbar.

No other changes — business logic, queries, and layout untouched.
