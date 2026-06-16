# Summary Report Tab

Add a new **Summary** tab on `/reports`, placed immediately after the **Daily Labour Report** tab. It reuses the same Daily Labour data source so totals stay in sync with the DLR.

## Filters (top of tab)
- **From Date** (default: start of current month)
- **To Date** (default: today)
- **Project** — uses existing `ProjectCombobox`; supports "All Projects" for users with access to multiple

## Metrics shown
For the selected range and project filter:

1. **KPI cards (top row)**
   - Total Labour Count (sum of headcount across all daily entries in range)
   - Average Labour per Week (total labour ÷ number of ISO weeks covered in range)
   - Total Labour for the Month (sum for the calendar month containing To Date, intersected with available data)

2. **Project-wise Summary table**
   | Project | Total Labour | Avg Labour / Week | Total Labour (Month of To Date) | Days Reported |
   - One row per project (respects project filter — single row if a specific project chosen, otherwise all accessible projects)
   - Sortable; bottom "Total" row

## Data source
- Queries `daily_manpower` filtered by `entry_date` between From/To and optional `project_id`, joined to `projects` for names.
- Only `status = 'approved'` entries are counted (matches DLR semantics).
- Aggregation done client-side in `useMemo` from the same fetch the page already does (extended to honor the date range when on Summary tab).

## Files touched
- `src/routes/reports.tsx` — add `TabsTrigger value="summary"`, render new `<SummaryReport />` section, add a small inline component for the KPI cards + table. No new routes, no DB changes.

## Out of scope
- Excel export for Summary (can be added later if requested)
- Contractor/department breakdowns inside Summary (those exist on the Project/Contractor tabs)
