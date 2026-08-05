# Reports: Alphabetical Project Dropdown Order

Sort every project dropdown in the Reports screen alphabetically (A–Z) by project name.

## Changes

1. **`src/components/ProjectCombobox.tsx`**
   - Sort the incoming `projects` prop by `name` (case-insensitive, A–Z) before rendering the dropdown list.
   - Preserve the selected-project lookup and all existing behaviour (search, all option, formatting, callbacks).

2. **`src/components/ProjectMultiCombobox.tsx`**
   - Sort the incoming `projects` prop by `name` (case-insensitive, A–Z) before rendering the checkbox list.
   - Preserve the "All Projects" row, selection state, toggle logic, and search filtering.

## Out of scope

- No changes to data fetching, filters, exports, or any other Reports functionality.
- Existing project formatting (`[code] name`, group labels) remains unchanged.
