## Fix Available Contractors list scope

In `src/components/ProjectAssignments.tsx`, the Contractors tab currently shows every contractor that isn't already assigned to another project in the Available column. The user wants the Available column to be scoped only to the currently selected project — i.e. never surface contractors that belong to (or were created outside of) this project.

### Change

In `AssignmentSection` (kind === `contractors` branch of `load()`):
- Treat every contractor NOT already assigned to this project as "not related" and hide them from the Available list.
- Result: Assigned column keeps showing this project's 115 contractors; Available column shows 0 entries with the existing "No more available." empty state.
- Users add new contractors to the project exclusively via the existing **Add & Assign** dialog (which already creates the contractor and links it to the current project in one step).

Departments and Categories tabs are unchanged — those masters are shared across projects by design.

### Technical detail

Replace the visibility filter for `kind === "contractors"` so `visible` only contains contractors whose id is in `assignedHere`. Drop the now-unused `get_globally_assigned_contractor_ids` RPC call for this screen (the DB function stays; only this caller is removed).

No schema, RLS, or migration changes required.