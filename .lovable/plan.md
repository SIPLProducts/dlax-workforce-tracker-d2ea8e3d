## Root cause

The error is occurring because the Contractors form always tries to create a new contractor record first.

`TL001` already exists in the contractor master list, so the database blocks creating another contractor with the same contractor code before the app gets a chance to assign it to the selected project.

## Plan

1. **Update the contractor create flow**
   - When the user clicks **Create**, first check whether a contractor with the same contractor code already exists.
   - If it exists, do not create a duplicate contractor master record.
   - Instead, assign the existing contractor to the currently selected project.

2. **Add project-level duplicate validation**
   - Before assigning, check whether that contractor is already assigned to the selected project.
   - If already assigned, show a friendly message like:
     - `Contractor TL001 is already assigned to this project.`
   - Do not insert a duplicate project assignment.

3. **Keep cross-project assignment allowed**
   - If contractor `TL001` exists under another project but not the current project, the app will add the project assignment successfully.
   - The same contractor can appear under multiple projects.

4. **Clean up the earlier database fix attempt**
   - The previous migration tried to drop a constraint, but the active blocker is actually a standalone unique index on `contractors.contractor_code`.
   - I will leave the global contractor-code uniqueness in place because the requirement is to assign the same contractor to different projects, not create duplicate contractor master records.

5. **Improve error messages**
   - Replace raw database errors like `duplicate key value violates unique constraint` with user-friendly messages in the Contractors screen.

## Technical details

- File to update: `src/routes/masters.contractors.tsx`
- No schema change is required for the main fix.
- Existing database rule `UNIQUE (project_id, contractor_id)` already protects against assigning the same contractor record twice to the same project.
- The create logic will become: find existing contractor by code → check project assignment → assign or create as needed.