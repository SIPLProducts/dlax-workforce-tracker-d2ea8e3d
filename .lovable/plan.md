## Goal
When a department is assigned to a project in Project Assignments, automatically assign the categories that are mapped to that department (via `department_categories`) into the project's Categories list as well. This keeps the Daily Entry Sheet's category dropdown aligned with the Department → Category mapping.

## Scope
Frontend-only change in `src/components/ProjectAssignments.tsx`. No DB schema changes, no changes to the Departments master screen or Daily Entry screen.

## Behavior

1. **Single assign** (checking one department in the Departments tab):
   - Insert into `project_departments` (current behavior).
   - Look up `department_categories.category_id` for that department.
   - Insert any not-yet-assigned ones into `project_categories` (ignore conflicts on the unique `(project_id, category_id)` pair).
   - Show a toast like "Also auto-assigned N categories".

2. **Bulk assign** (Select all in Departments tab):
   - After bulk-inserting departments, gather all mapped categories for the inserted department ids, dedupe, and insert missing ones into `project_categories`.

3. **Unassign**:
   - Removing a department does NOT auto-remove categories (categories may be shared across departments or assigned manually). Keep current behavior.

4. **Create & Assign new department**:
   - A brand new department has no category mappings yet, so no auto-assign needed beyond current behavior.

5. **Contractors / Categories tabs**: unchanged.

## Technical notes
- Implement by passing an `onAssigned(ids: string[])` callback from `ProjectAssignments` parent into the departments `AssignmentSection`, or handle inline in `toggle`/`bulkAssign` when `kind === "departments"` by querying `department_categories` directly with `supabase`.
- Use upsert with `onConflict: "project_id,category_id"` (or pre-filter against currently-assigned category ids from a fresh fetch) to avoid duplicate-key errors when some categories are already assigned.
- If the Categories tab is currently mounted, its local `assigned` Set needs refresh. Simplest: lift a small refresh signal (a `categoriesVersion` counter in `ProjectAssignments`) that bumps after department auto-assign, and have the categories `AssignmentSection` re-`load()` when it changes.

## Out of scope
- No change to how departments/categories are mapped in the Departments master screen.
- No change to Daily Entry — it already reads from `project_categories`, so it will automatically reflect the new rows.
