## Goal

On `/masters/assignments` (Contractors tab), add a **"+ New Contractor"** button that opens a dialog with the **full contractor master form** (SC Code, Company Name, Contact Person, Phone, Contact Number, License Number, Work Place, Nature of Work). On save, the new contractor is created and auto-assigned to the currently selected project.

The existing inline "Create new contractor" single-field row + "Add & Assign" button stays exactly as is — this is purely additive.

## Where

`src/components/ProjectAssignments.tsx` → `AssignmentSection` component, contractors kind only.

## UI

- Add a small `Button` ("+ New Contractor", outline/secondary) above the search box, only when `kind === "contractors"` and `canCreate` is true.
- Clicking it opens a shadcn `Dialog` with the same fields as the Contractors master Add dialog:
  - SC Code (`contractor_code`)
  - Company Name (required)
  - Contact Person
  - Phone
  - Contact Number (validated: optional, but if entered must be exactly 10 digits, numeric-only with sanitizing onChange — matching existing rule in `masters.contractors.tsx`)
  - License Number
  - Work Place
  - Nature of Work
- Buttons: Cancel, Save & Assign.

## Save logic (mirror `handleSave` add-flow from `masters.contractors.tsx`)

1. Validate `company_name` non-empty and `contact_number` format if provided.
2. If `contractor_code` is provided, look up existing contractor by code (case-insensitive).
   - If found → check `project_contractors`; if already linked, error "already assigned". Otherwise, insert link row only.
   - If not found → `insert` into `contractors`, then insert into `project_contractors`.
3. If no code → insert new contractor row, then assign.
4. On 23505 unique-code conflict, show friendly error.
5. On success: toast, close dialog, reset form, call `load()` so the new contractor appears in Assigned.

## Out of scope

- No changes to the existing inline name-only quick-add row.
- No changes to Departments / Categories tabs.
- No schema changes.
- No changes to `masters.contractors.tsx`.
