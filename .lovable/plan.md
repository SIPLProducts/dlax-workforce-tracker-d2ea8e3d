## Goal

Rename the **Departments** screen to **Category of Labour** wherever the user sees the label, while keeping the underlying database, route paths, and column structure unchanged.

## Files to update (frontend text only)

### 1. `src/routes/masters.departments.tsx`
- Page heading `Departments` → `Category of Labour`
- Sub-heading `Manage departments / trades and their worker categories` → `Manage categories of labour and their worker sub-categories`
- Button `Add Department` → `Add Category of Labour`
- Search placeholder `Search departments...` → `Search categories of labour...`
- Empty state `No departments found` → `No categories of labour found`
- Delete confirm `Delete this department?` → `Delete this category of labour?`

### 2. `src/components/AppSidebar.tsx`
- Sidebar nav item `Departments` → `Category of Labour`

### 3. `src/components/MobileTabBar.tsx`
- If it lists Departments, rename to `Category of Labour`.

### 4. `src/lib/screens.ts`
- Update the display label for the `masters_departments` screen key to `Category of Labour` (so the role-permissions UI shows the new name). The internal key stays the same.

## Intentionally NOT changing

- Database table name `departments` and all foreign keys
- Route path `/masters/departments` (URL stays the same — no broken bookmarks)
- The inner column header `Categories` (that one already correctly lists worker categories like Mason, Welders)
- Daily Entry, Reports, and any other screen that joins on `department_id`

## Out of scope

- No database migration
- No new fields or columns
- No URL/route renaming

This is a small, frontend-only label rename across ~4 files.