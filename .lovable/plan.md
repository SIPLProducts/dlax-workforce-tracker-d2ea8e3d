## Goal
Make `/masters/contractors` project-scoped: pick a project at the top, and the entire screen (list, search, dashboard KPIs, charts, create) operates only on contractors mapped to that project via the existing `project_contractors` join table.

## Changes (single file: `src/routes/masters.contractors.tsx`)

1. **Project selector (top of page)**
   - Add a `Project` dropdown in the PageHeader area (next to Template/Upload/Export/Add buttons, or just below).
   - Source: `projects` table, filtered to projects the current user has access to (admins see all; others scoped via `user_projects` — same pattern as Daily Entry already uses).
   - Persist the last-selected project in `localStorage` so the screen remembers it across navigations.
   - If the user has access to only one project, auto-select it. If none, show an empty-state message.

2. **List filtered by project**
   - Replace `supabase.from("contractors").select("*")` with a query that joins through `project_contractors`:
     ```
     supabase.from("project_contractors")
       .select("contractor:contractors(*)")
       .eq("project_id", selectedProjectId)
     ```
   - Map to the existing `items` shape so the table, search, and existing render code stay unchanged.
   - Reload whenever the selected project changes.

3. **Create / Add Contractor auto-maps to the selected project**
   - In `handleSave` (insert branch): after inserting into `contractors`, immediately insert `{ project_id: selectedProjectId, contractor_id: newId }` into `project_contractors`.
   - Edit and Delete behavior unchanged (still operate on the master `contractors` row).
   - Disable the "Add Contractor" button when no project is selected.

4. **CSV Upload auto-maps imported rows to the selected project**
   - After the bulk insert into `contractors`, also bulk-insert the new ids into `project_contractors` for the selected project.
   - Duplicate-skip logic now considers contractors already mapped to *this project* (not global), so the same master contractor can exist in multiple projects without conflict.

5. **Dashboard filters & KPIs become project-scoped**
   - The existing `loadManpower` already queries `daily_manpower`. Add `.eq("project_id", selectedProjectId)` so KPIs, the Worker Trend chart, and Top Contractors reflect the selected project only.
   - The "Contractor" filter dropdown inside the dashboard card now lists only contractors mapped to the selected project (same `items` array).
   - "Contractors by Nature of Work" chart uses the filtered `items` (already does).

6. **Empty / no-project state**
   - When no project is selected, show a clear inline message ("Select a project to view its contractors") and hide the list/dashboard cards.

## Out of scope
- No schema changes — `project_contractors` already exists with the right shape and policies.
- No changes to `/masters/assignments` (bulk project-mapping there continues to work).
- No changes to Departments, Categories, or other master screens.
- No "remove from project without deleting" action — Delete still deletes the master contractor record.

## Verification
- Switch projects → list and KPIs update.
- Add a contractor while Project A is selected → it appears only under Project A, not Project B.
- Upload CSV under Project A → all imported contractors are mapped to Project A only.
- Non-admin user with access to only Project A sees only Project A in the dropdown.
