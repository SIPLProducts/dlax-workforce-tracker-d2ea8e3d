

# Import Excel Data into Daily Manpower Table

## What
Parse the uploaded Excel file (GENMNGR-Daily_Labour_Report_new-2.xlsx), extract date-wise manpower data per contractor/department/category, and insert it into the `daily_manpower` table. This will populate the Reports page with real data.

## Approach

1. **Read the Excel file** with pandas to understand its structure (sheets, columns, date-wise layout)
2. **Map Excel data to master tables** — match contractor names, department names, and worker categories to their UUIDs in the database. Create any missing departments if needed (departments table is currently empty).
3. **Transform rows** into `daily_manpower` insert format: `entry_date`, `project_id`, `contractor_id`, `department_id`, `category_id`, `headcount`, `hours_worked`, `overtime_hours`, `nmr_mason`, `nmr_male_helpers`, `nmr_female_helpers`, `security_count`, `remarks`
4. **Insert data** into `daily_manpower` using the database insert tool

## Steps

1. **Copy and inspect Excel** — read all sheets with pandas to understand the exact column layout and date structure
2. **Create missing departments** — if the Excel references departments not yet in the DB, create them via migration or insert
3. **Build a Python script** to:
   - Parse each sheet/row
   - Fuzzy-match contractor and category names to existing DB records
   - Generate SQL INSERT statements
4. **Execute inserts** using the database insert tool
5. **Verify** by querying `daily_manpower` count and checking the Reports page

## Notes
- The project has only one project in the DB ("Construction of Integrated Township at BTPS, Manuguru") — all data will be linked to it
- Departments table is empty — will need to create departments from the Excel data first
- Worker categories exist (Electrician, Fitter/Rigger, Helper, etc.) — will map from Excel

