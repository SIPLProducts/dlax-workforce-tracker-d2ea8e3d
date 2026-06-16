# Summary Report — May'26 Sheet Format

Add a new **Summary Report** view (alongside Daily Labour Report on `/reports`) that renders daily approved headcount in the exact matrix layout of the uploaded May'26 sheet — projects as rows, days as columns, with weekly average columns and a monthly total column. All numbers computed dynamically from `daily_manpower`.

## Filters
- **From Date** (default: 1st of current month)
- **To Date** (default: today)
- **Project**: existing `ProjectCombobox` with "All Projects" (matches the multi-project rows in the sheet); selecting one project shows just that row.

## Layout (mirrors the screenshot)

```text
Header:  KPC Projects Limited
         Manpower engaged for <From> – <To>

Columns: S.No │ Project Name │ <Day1> <Day2> … <Day7> │ Avg Week-N │ <Day8> … │ Avg Week-N+1 │ … │ Total Labour for the Month
Rows:    One row per project (only the "Total" line — no Item Rate / NMR split)
         Bottom "Grand Total" row summing every column
```

- **Daily cell** = sum of approved `daily_manpower.headcount` for that project on that day (0 if none).
- **Weekly average column** inserted after every 7 day-columns, labelled `Average per Week-NN` using ISO week number of the last day in that block. Value = mean of those 7 daily cells.
- **Monthly Total column** = sum of all daily cells in the selected range for that project (the sheet calls it "Total labour for the month").
- **S.No** = sequential 1..N for the projects with any data in range.

## Data source
Single query:
```ts
supabase.from('daily_manpower')
  .select('entry_date, headcount, project_id, projects(name, code)')
  .gte('entry_date', from).lte('entry_date', to)
  .eq('status','approved')
  .maybeEq('project_id', selected)  // when not "All"
```
Aggregate client-side in `useMemo` into a `Map<projectId, Map<dateISO, total>>`, then render.

## UX
- Tabs on `/reports`: keep existing tabs; add (or replace the previously-added) **Summary** tab.
- Sticky left columns (S.No, Project Name) and sticky header row for horizontal scroll.
- Weekly-avg columns highlighted with a subtle bg; Monthly Total column bold.
- **Excel export** button — generates an `.xlsx` matching this layout (header rows, merged title, weekly-avg columns, totals) via the existing xlsx export pattern used elsewhere.
- Empty state when no approved data in range.

## Files
- `src/routes/reports.tsx` — add/replace the `SummaryTab` component with the new matrix layout and export handler.
- No DB changes, no new routes, no schema additions.

## Out of scope
- Item Rate vs NMR split (no field exists for it; would need a new column on `contractors`).
- Contractor / department / category breakdowns inside Summary.
- Editing approval status from this view.
