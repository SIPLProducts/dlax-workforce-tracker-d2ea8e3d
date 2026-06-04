## Plan

1. Update the Contractors tab data loading in `ProjectAssignments` so the **Assigned** list is built only from `project_contractors` rows for the currently selected project, joined to their contractor details.

2. Keep the **Available Contractors** list as contractors not currently assigned to the selected project, so if a contractor is removed from Assigned it immediately appears in Available and can be assigned again.

3. Preserve existing behavior for Departments and Categories; only change contractor-specific loading/filtering logic.

4. Verify the selected-project behavior in the preview: changing the project should refresh the Contractors tab so Assigned shows only that project’s linked contractors, not all contractor master records.