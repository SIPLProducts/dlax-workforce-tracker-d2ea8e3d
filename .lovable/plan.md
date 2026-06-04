## Problem

On `Projects`, `Departments`, and `Categories` master screens, the `Code / Name / Group …` column headers appear floating in the middle of the table when the page scrolls. The `<thead>` cells are `sticky` with offsets `top-[112px] md:top-[144px]`, but the actual bottom edge of the `PageHeader` (which is itself `sticky top-14`) sits around ~120px. The mismatch leaves a gap where rows scroll through behind the area where the header should be, so the headers appear to "land" mid-table instead of locking flush under the PageHeader bar.

## Fix

Update the sticky offset on each masters table's `<TableHeader>` so the header row sticks directly below the PageHeader with no gap.

Change in all three files:

- `src/routes/masters.projects.tsx` (line 324)
- `src/routes/masters.departments.tsx` (line 202)
- `src/routes/masters.categories.tsx` (line 114)

Replace:
```
[&_th]:sticky [&_th]:top-[112px] md:[&_th]:top-[144px] [&_th]:z-[5] [&_th]:bg-card
```
with offsets that match the real PageHeader bottom:
```
[&_th]:sticky [&_th]:top-[110px] md:[&_th]:top-[126px] [&_th]:z-[5] [&_th]:bg-card [&_th]:shadow-[0_1px_0_0_hsl(var(--border))]
```

- `top-14` (56px) TopBar + PageHeader (`py-3` mobile ≈ 54px, `py-4` desktop ≈ 70px) ⇒ thead sticks at 110px mobile / 126px desktop, flush under PageHeader.
- Adds a 1px bottom shadow on the sticky `th` so the boundary between header and first row reads cleanly while scrolling.

## Out of scope

- No changes to columns, data, filters, PageHeader component, or any other route.
- No change to table structure or row rendering.
