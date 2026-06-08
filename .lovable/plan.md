## Problem

In `masters.contractors.tsx` (`handleSave`, lines ~177-219), when adding a contractor:
1. It first looks up an existing contractor by **SC Code** (good).
2. If not found by code, it **falls back to matching by company name** across ALL projects.
3. If a contractor with the same name exists (from another project), it reuses that row and just links it to the new project — so the second project shows the first contractor's details (phone, contact #, contact person, license, etc.).

This breaks the user's intent of having distinct contractor records per project when SC Codes differ.

## Fix

Treat **SC Code as the unique identity key** for matching, not company name.

In `handleSave` (Add flow):
- If `contractor_code` is provided:
  - Look up by `contractor_code` only.
  - If found → check project link; assign to project if not already linked.
  - If not found → create a **new** contractor row (even if another contractor with the same company name exists).
- If `contractor_code` is empty:
  - Keep current name-based lookup (back-compat for legacy entries without codes), OR require the code — recommended to **require a non-empty SC Code** since the whole differentiation depends on it.

Drop the `existingByName` fallback entirely.

### CSV import (lines ~334-352)

Apply the same rule: project-scoped dedupe key is **contractor_code only**. Remove the `existingByName` map fallback so two rows with the same name but different codes create two contractor rows.

## Out of scope

- No DB schema changes. The existing `enforce_unique_contractor_code_per_project` trigger already enforces code uniqueness per project.
- Edit flow unchanged.
- Other masters screens unchanged.

## Open question

Should SC Code become **mandatory** on the Add Contractor form? Without it, two contractors with the same name and no code are indistinguishable. Recommend: yes, require it.
