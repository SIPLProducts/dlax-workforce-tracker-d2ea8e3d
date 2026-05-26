## Goal
Move the "Select all" button from below the Available list to above it (between the "Available (N)" header and the list of items).

## Changes

**`src/components/ProjectAssignments.tsx`**: Move the `<Button>` rendering "Select all (N)" / "Select all matching (N)" from after the list `<div>` to before it, just under the Available header. Keep all behavior, styling, gating, and label logic identical.

## Out of scope
- Assigned side, search, per-item controls, DB/RLS — no changes.
