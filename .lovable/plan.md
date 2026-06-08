## Change

In `src/components/ProjectAssignments.tsx`, on the **Contractors** tab only:

1. **Remove** the inline "Create new contractor" label + name-only input + "Add & Assign" button row.
2. **Remove** the separate "New Contractor (full details)" button row added earlier.
3. **Replace** both with a single **"Add & Assign"** button (top-right, same position as before) that opens the existing full-details `NewContractorDialog` (SC Code, Company Name, Contact Person, Phone, Contact Number, License Number, Work Place, Nature of Work).
4. On save → create contractor + assign to current project + refresh list (already implemented in `NewContractorDialog`).

## Untouched

- Departments and Categories tabs keep their existing inline "Create new …" + "Add & Assign" row exactly as is (their flow is name-only and works correctly).
- Search, Assigned/Available lists, bulk assign, toggle assign — unchanged.
- `createAndAssign` function stays (still used by Departments/Categories).
- No DB or schema changes.

## Implementation detail

Guard the existing inline `canCreate` block with `kind !== "contractors"` so it renders for departments/categories only. For `kind === "contractors"`, render only the "Add & Assign" button that opens `NewContractorDialog`.
