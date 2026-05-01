## Goal

Revert the sidebar label back to **Departments**. Keep the page heading and other in-page text as **Category of Labour**.

## Change

### `src/components/AppSidebar.tsx`
- In `masterItems`, change the label for `/masters/departments` from `Category of Labour` back to `Departments`.

## Not changing

- `src/routes/masters.departments.tsx` — page heading, button, search placeholder, and messages stay as "Category of Labour".
- `src/lib/screens.ts` — permissions label stays as "Category of Labour (Master)".
- Route path, database, and column structure remain unchanged.