## Goal
Add an "SC Code" column to the Daily Entry Sheet table, positioned between "SI.no" and "Name of the Contractor". Value comes from `contractors.contractor_code`.

## Changes

**`src/routes/daily-entry.tsx`**
- In the entry sheet table header, insert a new `<TableHead>` "SC Code" between SI No and Name of the Contractor (spanning the grouped header rows correctly so the existing CIVIL/Other group headers still align).
- In each contractor body row, insert a `<TableCell>` rendering `contractor.contractor_code ?? "—"`.
- Adjust the TOTAL footer row's leading colSpan by +1 so totals stay aligned.
- Apply the same change to the read-only View sheet rendering (so it appears identically in view mode and when Approvals navigates here).

## Out of scope
- No DB changes (column already exists on `contractors`).
- No changes to Approvals, Reports, or save/edit logic.
- No change to the Contractors master screen.
