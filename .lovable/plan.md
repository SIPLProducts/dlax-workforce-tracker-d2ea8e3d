## Goal
In Project Assignments (all three tabs: Contractors, Departments, Categories), add a "Select all" control in the Available list header that assigns every currently-visible available item in one action, plus an "Unassign all" control on the Assigned side to mirror it.

## Changes

**`src/components/ProjectAssignments.tsx`** — single section component, applies to all three tabs:

- Add `bulkAssign()` and `bulkUnassign()` helpers:
  - Operates on the currently filtered list (respects the search box) — so "Select all" with a search term scopes to the filtered subset; with no search it selects everything.
  - `bulkAssign`: builds `availableItems.map(i => ({ project_id, [joinFk]: i.id }))` and does a single `supabase.from(joinTable).insert([...])`. Then merges those ids into the `assigned` set.
  - `bulkUnassign`: single `supabase.from(joinTable).delete().eq("project_id", projectId).in(joinFk, assignedItemIds)`. Then removes those ids from the set.
  - Both gated by `canAssign`, show toast on success/error, set `busy`.

- UI additions inside each section:
  - **Available header**: add a small "Select all" button (text/link style) on the right, disabled when `availableItems.length === 0` or `busy` or `!canAssign`. Label changes to "Select all (N)" using the filtered count. When a search term is active and filters the list, show "Select all matching (N)" instead.
  - **Assigned header**: add a small "Unassign all" button on the right with the same pattern (disabled when empty / busy / no permission). When a search term is active, label becomes "Unassign all matching (N)".
  - Confirmation: add a `window.confirm` for unassign-all only (assign-all is reversible per item, but unassign-all wipes the project's set).

## Out of scope
- No DB or RLS changes (existing insert/delete policies already cover bulk ops; current per-item RLS expressions match any single row, so inserts/deletes of multiple rows in one statement are evaluated per-row).
- No change to the tab structure, search input, or the per-item +/× controls.
- No change to other screens.
