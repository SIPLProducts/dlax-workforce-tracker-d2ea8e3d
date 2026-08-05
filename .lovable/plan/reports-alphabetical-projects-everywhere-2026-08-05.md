# Reports: Alphabetical Projects Everywhere

Make project ordering alphabetical (A–Z) across the whole Reports screen — dropdowns and the report rows/sheets — without changing filters, totals, or exports behaviour.

## Ordering rule

Sort by Project Code when a code exists, otherwise by Project Name; comparison is case-insensitive (`localeCompare` with `sensitivity: "base"`, `numeric: true` so `P2` comes before `P10`). Existing project-group grouping stays: groups remain sorted A–Z, and projects are sorted A–Z inside each group.

## Changes

1. **Shared sort helper (`src/routes/reports.tsx`)**
   - Add one small comparator used by every tab, so all lists agree on order.

2. **Project list source (`src/routes/reports.tsx`)**
   - Sort the fetched `projects` array with the comparator right after loading, so dropdowns, group filters, and every derived list inherit the order.

3. **Daily tab**
   - Sort the displayed rows by project (code/name), then by entry date and contractor, so the table and its Excel export come out project-alphabetical.

4. **Daily Labour Report tab**
   - Sort `selectedProjects` with the comparator so the on-screen preview and each Excel/Matrix sheet appear in alphabetical project order (currently "All Projects" order follows the raw fetch order).

5. **Summary tab**
   - Replace the current name-only row sort with the comparator, keeping group headers and grand totals as-is. Both Excel and Matrix exports read from these rows, so they follow automatically.

6. **Weekly tab**
   - Dropdown already inherits sorted projects; contractor row order inside the report stays unchanged.

## Out of scope

- No changes to data fetching filters, approval-status logic, totals/averages, or contractor/department/category ordering.
- No visual/format changes to exported workbooks beyond row order.
