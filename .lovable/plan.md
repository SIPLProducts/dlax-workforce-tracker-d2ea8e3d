## Plan: Fully dynamic Daily Labour Report

### Goal
Generate the Daily Labour Report entirely from configured project Departments, Categories, and actual daily records, so new or renamed Departments/Categories appear automatically without code changes.

### What will change
1. **Remove hardcoded DLR report columns**
   - Stop hardcoding `Total Labour`, `NMR % on Total`, and any NMR-specific report logic in the DLR matrix/preview.
   - Keep only the base identity columns needed for the sheet (`Sl.No.`, project name) and the dynamic department/category columns.
   - Keep the final `Total` column as a calculated sum of all dynamic category columns.

2. **Build headers only from project configuration**
   - Load project departments from `project_departments`.
   - Load project categories from `project_categories`.
   - Link categories to departments through `department_categories`.
   - Render department names exactly as stored in the database.
   - Render category names exactly as stored in the database.
   - If departments/categories are renamed or newly assigned to the project, they will automatically appear in the report.

3. **Aggregate sheet data dynamically**
   - For each configured category column, sum actual `daily_manpower.headcount` records matching that category for the selected project/date.
   - Display `-` for empty or zero values.
   - Calculate `Total` from the dynamic category totals, not from hardcoded contractor/nature-of-work buckets.

4. **Align preview and exports**
   - Update the on-screen DLR preview to render directly from the dynamic matrix metadata.
   - Update Excel/CSV generation to use the same dynamic columns and merges.
   - Keep the empty-data behavior: show the full configured header and one project row with `-` values.

### Technical notes
- Files to update:
  - `src/lib/dlr-daily.ts`
  - `src/components/DlrDailyPreview.tsx`
  - `src/routes/reports.tsx`
- The current remaining hardcoded issue is coming from fixed DLR columns and NMR-specific logic in `dlr-daily.ts`/`DlrDailyPreview.tsx`, plus fallback behavior in `reports.tsx` that can pull global categories instead of strictly project-configured structure.
- No database schema changes are needed.