## Plan

1. **Make the DLR columns fully records-driven**
   - Build department/category columns only from `daily_manpower` rows for the selected project and date.
   - Remove project master/configured categories from the DLR matrix so unused categories do not appear as extra columns.

2. **Make preview and export use the exact same matrix**
   - Keep Excel, CSV, and on-screen preview generated from one `getDlrDailyMatrix` result.
   - Add a small export guard so downloads cannot run while refreshed data is still loading.

3. **Preserve dynamic Total Labour behavior**
   - Keep `Total Labour` sub-columns based only on distinct `contractors.nature_of_work` values found in the selected date’s actual rows.
   - Do not hardcode names like NMR, Pump Gang, departments, categories, or contractor work types.

4. **Validate with the shown example**
   - For BHELSTPP on 12-06-2026, the generated columns should come only from the 5 live rows found for that date:
     - Departments/categories from actual rows: Civil/Painting, Civil/Structural Steel Work, Electrical/Street Lighting.
     - Total Labour sub-columns from actual rows: Concrete/Shuttering & Rod Bending Work, NMR, Pump Gang, Shuttering & Rod Bending Work.
   - Confirm no unused project-assignment categories appear in preview or export.