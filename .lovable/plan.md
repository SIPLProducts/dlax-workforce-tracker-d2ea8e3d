# Update Departments screen column label

On `/masters/departments`, the first column header currently says **"Name"**, which is ambiguous. Rename it to **"Category of Labour"** so it clearly describes the labour grouping (Civil, Electrical, etc.) listed in that column.

## Changes

- **File:** `src/routes/masters.departments.tsx`
  - Change the `<TableHead>` text from `Name` to `Category of Labour`.
  - No data, schema, or logic changes — purely a label update on the table header.

Everything else on the screen (add/edit form, search, categories column, actions) stays exactly as it is.

If you actually meant something different (e.g. swap this screen with the Worker Categories screen, or add a new column), let me know and I'll adjust.