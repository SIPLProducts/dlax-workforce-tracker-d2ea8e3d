## Goal
Remove the "Unassign all" button from the Assigned header, and move the "Select all" control from the Available header to the bottom of the Available list in each of the three tabs (Contractors, Departments, Categories).

## Changes

**`src/components/ProjectAssignments.tsx`**:

- Remove the `bulkUnassign()` helper and the "Unassign all" button rendered in the Assigned header. The Assigned header reverts to just the count label.
- Keep `bulkAssign()` as-is (operates on currently-filtered `availableItems`, gated by `canAssign`, toasts on success/error).
- Move the "Select all" button out of the Available header and render it at the bottom of the Available list container — below the list of available items, full-width, text/link style.
  - Disabled when `availableItems.length === 0`, `busy`, or `!canAssign`.
  - Label: `Select all (N)` normally, `Select all matching (N)` when a search term is active.
  - Hidden entirely when there are no available items (so it doesn't show under the "No more available." message).

## Out of scope
- No DB/RLS changes.
- No changes to tab structure, search input, per-item +/× controls, the Assigned side, or other screens.
