## Fixes for Summary Report

### Issue 1 — "All Projects" shows only 2 projects
`SummaryTab` builds rows only from `daily_manpower` results, then filters out any project where `monthTotal === 0`. Projects that have no approved entries in the date range are dropped entirely.

**Fix:** When "All Projects" is selected, seed the project list from the `projects` prop (which already holds every project the user can see) so every project appears as a row, with zeros across the date columns when there's no manpower data. When a specific project is selected, show just that project (even if its total is 0). Remove the `monthTotal > 0` filter.

Grand Total row and KPI cards (Total Labour, Avg Labour/Week, Total Labour for the Month) keep using actual `daily_manpower` data, so the numbers don't change — only more rows are rendered.

### Issue 2 — Weekly average shows 0
The current formula divides the week's sum by `dayKeys.length` (the number of days in that ISO week that fall within the selected range). For a week with no entries, that's `0 / 7 = 0`, which is mathematically correct but not what's useful in the Excel template — the May'26 sheet averages only over days that actually had labour.

**Fix:** Compute the weekly average as `sum / count_of_days_with_headcount > 0` within that week. If no day in the week has any data, show `—` (or blank) instead of `0`, so empty weeks are visually distinct from "averaged to zero". Apply the same rule to the Grand Total avg cell and to the Excel export.

### Files
- `src/routes/reports.tsx` — update `SummaryTab` only:
  - seed `byProject` from `projects` prop when `projectId === "all"` (or just from the selected project)
  - drop the `monthTotal > 0` filter; sort by project name
  - change weekly average denominator to "days-with-data" and render blank when denominator is 0
  - mirror the same blank-on-empty logic in the `exportXlsx` builder

No DB changes, no schema changes, no other files touched.