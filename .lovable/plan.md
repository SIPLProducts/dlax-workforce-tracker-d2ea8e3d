## Problem
In `src/components/ProjectAssignments.tsx`, assigning a department auto-assigns its mapped categories (via `autoAssignCategoriesForDepartments`). But un-assigning a department leaves its categories behind, and the Categories tab does not refresh.

## Fix
Mirror the auto-assign behavior on removal.

1. Add a helper `autoRemoveCategoriesForDepartments(projectId, removedDepartmentIds)` in `ProjectAssignments.tsx` that:
   - Fetches `department_categories.category_id` for the removed department(s).
   - Fetches the project's still-assigned departments (`project_departments` minus the removed ones).
   - Fetches `department_categories` for those remaining departments to know which categories are still justified.
   - Computes orphan categories = mapped to removed dept(s) AND not mapped to any remaining assigned dept.
   - Deletes those from `project_categories` for this project.
   - Returns the count removed.

2. In `toggle()` (single uncheck) for `kind === "departments"` in the `else` branch: after the successful delete, call the helper for `[id]`. If `n > 0`, show a toast (`Also removed N categor(y/ies)`) and call `onCategoriesChanged()` so the Categories section re-fetches via `refreshKey`.

3. No changes to bulk-assign, contractors, or categories sections. No schema changes. Only edits to `src/components/ProjectAssignments.tsx`.

## Notes
- Categories that the user manually assigned (not mapped to the removed dept) are untouched.
- Categories still mapped to another assigned department are retained.
- The existing `refreshKey` plumbing already re-renders the Categories list when `onCategoriesChanged()` fires.
