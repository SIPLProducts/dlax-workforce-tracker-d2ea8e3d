## Goal
In Daily Entry Sheet, make department group headers and category columns come strictly from the selected project's assignments in Project Assignments — same way contractors are now scoped. Nothing global, nothing hardcoded.

## Scope (single file mostly)
`src/routes/daily-entry.tsx` — replace the hardcoded department/category grid with a dynamic one driven by `project_departments`, `project_categories`, and `department_categories`.

`src/routes/reports.tsx` — switch reporting to read real `department_id` / `category_id` columns instead of parsing the legacy JSON blob in `remarks`.

One SQL migration to backfill historical `daily_manpower` rows from the legacy JSON-blob format into proper per-category rows.

## Behavior after change

1. **Project selected → fetch in parallel:**
   - `project_departments` → assigned department rows (ordered by name)
   - `project_categories` → assigned category rows
   - `department_categories` → mapping
2. **Build grid dynamically:**
   - One group header per assigned department
   - Under each department, only categories that are both assigned to the project AND linked to that department via `department_categories`
   - Categories assigned to the project but not linked to any assigned department → grouped under "Other"
   - If a category is linked to multiple assigned departments (e.g. Helpers under CIVIL and MEP), it appears as a separate column under each group, entered independently (Option A — matches existing data model)
3. **Empty states:**
   - No assigned departments → show row: "No departments assigned to this project. Assign some in Masters → Project Assignments."
   - No assigned categories → similar row for categories
4. **Save:** one `daily_manpower` row per `(contractor_id, category_id)` with nonzero headcount, populating real `department_id` + `category_id`. Header-level fields (`security_count`, `deficiency_manpower`, `weather_condition`, free-text `remarks`) live on the first row per contractor. Old rows for the same `(project_id, entry_date, contractor_id)` not in the new payload are deleted.
5. **Load:** read headcounts directly from `headcount` keyed by `(contractor_id, category_id)`. For legacy rows (single fallback row + JSON blob in `remarks`), parse the blob using a hardcoded legacy-key→category-name map and project into the dynamic grid for display only.

## DB migration (backfill)
For each existing `daily_manpower` row whose `remarks` parses as the legacy JSON blob:
- Expand into one row per nonzero legacy key
- Resolve `category_id` (and `department_id` via `department_categories`) from the legacy key → name map
- Preserve `security_count`, `deficiency_manpower`, `weather_condition`, status, approver fields on the first expanded row
- Replace `remarks` with the free-text `_remarks` value only
- Skip rows where `category_id` already points to a real category (already migrated)

No schema changes — columns already exist.

## Reports update
`src/routes/reports.tsx` aggregates `daily_manpower.headcount` grouped by `category_id` and `department_id` joined to `worker_categories` / `departments`, instead of parsing JSON. Excel export columns become the union of categories present in the filtered range.

## Out of scope
- No changes to RLS, auth, approval workflow, or Project Assignments UI.
- No changes to `worker_attendance`.
- Contractor scoping (already shipped) is untouched.

## Files touched
- `src/routes/daily-entry.tsx` (main change)
- `src/routes/reports.tsx` (read path)
- one new SQL migration for legacy-row backfill
