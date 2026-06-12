## Plan

Update the Daily Labour Report so it is generated only from the selected project/date database records and project configuration, matching the reference layout as closely as the available database fields allow.

### What will change

1. **Remove remaining fake/fallback data sources**
   - Stop falling back to all worker categories when a project has no category assignment.
   - Stop falling back to all contractors when a project has no contractor assignment.
   - Stop creating placeholder groups such as “Other” from code unless the label comes from actual database data.
   - Keep structural report labels from the reference only, such as `Sl.No.`, `Name of the Project`, `Total`, and `Remarks`.

2. **Load DLR data for the selected project and date only**
   - Fetch `daily_manpower` rows filtered by:
     - selected `project_id`
     - selected `entry_date`
   - Include joined contractor, department, and category names from the database.
   - Build the report values from those rows only.

3. **Build headers dynamically from database configuration and actual records**
   - Department/category bands:
     - Prefer the project’s category configuration.
     - If selected-date rows contain department/category combinations missing from project configuration, include them from the actual row data so no recorded data disappears.
   - Total Labour sub-columns:
     - For dates with records, use distinct `contractors.nature_of_work` values from the selected-date records.
     - For dates with no records, use the selected project’s assigned contractors so the empty sheet still shows configured headers with `-` values.
   - Do not inject labels like `NMR`, `Sub Contractors/Job Works`, or contractor work names unless they exist in database records/configuration.

4. **Generate the complete row dynamically**
   - Category cells: sum `headcount` by category.
   - Total Labour cells: sum `headcount` by contractor `nature_of_work`.
   - Total: sum selected-date headcount.
   - Security: use `security_count` dynamically if the reference report includes it and database rows contain that field.
   - Deficiency manpower / OT: use existing database fields only where needed by the reference layout.
   - Empty numeric cells render as `-`.

5. **Keep exports identical to preview**
   - Excel and CSV generation will use the same matrix metadata as the preview.
   - Header merges, frozen columns, right-side fixed columns, and downloaded values will all come from the same dynamic report matrix.

### Files to update

- `src/routes/reports.tsx`
  - Replace the current separate fallback-heavy metadata loading with selected project/date-aware dynamic loading.
  - Remove global category/contractor fallbacks from DLR.

- `src/lib/dlr-daily.ts`
  - Adjust matrix creation to derive header leaves and totals from actual rows/configuration.
  - Add support for database-backed right-side fields only.
  - Ensure all zero numeric values export/display as `-`.

- `src/components/DlrDailyPreview.tsx`
  - Keep rendering from matrix metadata only so the preview matches Excel/CSV output.
  - Avoid any report data labels not supplied by the matrix.

### Validation

- Check the selected BHELSTPP / 12-06-2026 data directly against the database totals.
- Verify the preview row totals match the actual `daily_manpower` rows for that date.
- Verify Excel and CSV outputs contain the same headers and values as the preview.