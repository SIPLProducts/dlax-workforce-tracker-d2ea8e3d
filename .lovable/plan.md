## Diagnosis

Verified in DB:
- `contractors` has 1 row: **Gunti Venkataswamy** (created 2026-06-04 07:09).
- `project_contractors` is **empty** — no project mapping exists for that contractor.
- That is why the Contractors page shows 0 for BHELSTPP (it joins via `project_contractors`), while the Project Assignments page lists Gunti as "Available" for **every** project (the Assignments tab queries the full `contractors` master and lets you assign it to any project).

So two distinct issues:

1. **Orphan contractor**: Gunti Venkataswamy was inserted into the master but the `project_contractors` mapping never landed (likely the user created it via the Assignments tab's "Add & Assign" against a different selected project, or the mapping insert was lost). Result: no project owns it.
2. **Wrong sharing model**: `ProjectAssignments` (Contractors tab) lists every master contractor as "Available" for every project, by design of a shared master + many-to-many. The product requirement is that a contractor belongs to **one** project and must not appear under others.

## Fix

### 1. Repair the orphan row
Map the existing Gunti Venkataswamy contractor to BHELSTPP so it stops appearing as "Available" everywhere and starts showing up correctly on the Contractors page for BHELSTPP.

```text
INSERT INTO project_contractors (project_id, contractor_id)
VALUES ('69e5f2ca-eb38-4688-b447-289fe6e4e7d9',  -- BHELSTPP
        'd81269c7-c06f-4941-84f0-e0c63c59eb27'); -- Gunti Venkataswamy
```

### 2. Make contractors project-exclusive in the Assignments UI

Edit `src/components/ProjectAssignments.tsx` (Contractors tab only — departments/categories stay shared):

- When `kind === "contractors"`, load the **set of contractor ids already mapped to ANY project** and exclude them from the "Available" list (except the ones already assigned to the current project, which stay in "Assigned").
- This way a contractor created/assigned to Project A no longer shows up as Available for Project B.
- "Add & Assign" already creates a fresh master and maps it to the current project — that continues to work and the new row immediately drops out of Available for every other project.
- Unassigning a contractor from a project (the `X` button) keeps current behavior: the row becomes Available again, ready to be assigned elsewhere.

Departments and Categories continue to behave as shared masters (no change to those tabs).

### 3. No change to `masters.contractors.tsx`
The Contractors page already auto-inserts the `project_contractors` mapping on create and filters its list via the join. The orphan row was a one-off; the code path is correct.

## Out of scope
- No schema changes. Keeping `project_contractors` as the mapping table is enough; the exclusivity is enforced in the UI query. (If you later want hard exclusivity at the DB level, we can add a `UNIQUE (contractor_id)` constraint on `project_contractors` — say the word and I'll do it in a follow-up.)
- No changes to RLS, daily entry, reports, or approvals.
