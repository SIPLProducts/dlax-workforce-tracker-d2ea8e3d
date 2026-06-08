# Show SC Code in Contractors tab (Project Assignments)

## Change
In `src/components/ProjectAssignments.tsx`, update the `contractors` entry in `KIND_CONFIG` so each contractor row's label includes the SC Code (stored as `contractor_code` on the `contractors` table) alongside the company name.

- `masterLabel` for contractors becomes: `` `${r.contractor_code} — ${r.company_name}` `` when `contractor_code` exists, else just `company_name` (graceful fallback for rows without a code).

This automatically flows through to:
- Assigned list
- Available list
- Search (search will match against both code and name since the label string contains both)

No schema change, no other files touched. Departments and Categories tabs are unchanged.

## Out of scope
- Adding a separate column/badge styling for the code (current display uses a single text label per row).
- Editing/creating contractor codes from this screen.
