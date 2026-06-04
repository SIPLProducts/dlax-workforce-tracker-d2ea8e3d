## Problem

On `/masters/assignments` → Contractors tab:

- **Assigned** list correctly shows only contractors mapped to the selected project (via `project_contractors`).
- **Available** list currently *hides* any contractor mapped to another project. So if a contractor was assigned elsewhere, or moved between projects, it never reappears here and can't be re-assigned.

The user wants Available to show every contractor that is **not currently assigned to the selected project**, including contractors mapped to other projects, so they can be (re-)assigned.

## Change

In `src/components/ProjectAssignments.tsx`, inside `AssignmentSection.load()`:

- Remove the contractor-specific `excluded` set that filters out contractors already mapped to other projects.
- Available list becomes: every contractor master row whose id is **not** in `assignedHere`.
- Assigned list is unchanged (still scoped to current project's `project_contractors`).
- Toggle on/off behavior unchanged — removing a contractor deletes its `project_contractors` row, so it immediately reappears in Available.

Departments and Categories tabs already use this "available = everything not assigned here" rule, so no change there.

## Out of scope

- No DB schema, RLS, or migration changes.
- No changes to Contractors master page, CSV upload, departments, or categories.
- Per-project uniqueness of `contractor_code` is still enforced by the existing DB trigger.
