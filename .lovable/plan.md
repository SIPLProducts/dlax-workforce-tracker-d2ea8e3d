## Remove Project and Contractor tabs from Reports

On `/reports`, the tab bar currently shows: Daily • Project • Contractor • Daily Labour Report • Summary. Remove the two middle tabs so it becomes: Daily • Daily Labour Report • Summary.

### Changes (single file: `src/routes/reports.tsx`)

1. In the `TabsList` (around line 271), delete the `<TabsTrigger value="project">` and `<TabsTrigger value="contractor">` entries, and update the grid class from `sm:grid-cols-5` to `sm:grid-cols-3`.
2. Remove the corresponding tab-body sections rendered further down the file for `tab === "project"` and `tab === "contractor"` (the aggregated tables using `projectAgg` / `contractorAgg`), plus the drill-down dialog if it is only triggered from those tabs.
3. Clean up now-unused helpers if nothing else references them: `projectAgg`, `contractorAgg`, `aggregate`, and the `drill` state / dialog. Keep `byProject` / `byContractor` because the Daily tab's Breakdown cards still use them.

### Out of scope
No filter changes, no data-loading changes, no styling changes beyond the grid column count. Default `tab` remains `"daily"`, so no landing-tab adjustment needed.