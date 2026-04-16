

# Link Departments to Worker Categories

## What
Create a many-to-many relationship between departments and worker categories so that when creating/editing a department, you can select which categories belong to it. The departments table will show the linked categories, and during daily entry, category dropdowns can be filtered by the selected department.

## Database Changes

**New junction table**: `department_categories`
- `id` (uuid, PK)
- `department_id` (uuid, FK -> departments)
- `category_id` (uuid, FK -> worker_categories)
- `created_at` (timestamptz)
- Unique constraint on (department_id, category_id)
- RLS: admins can manage, authenticated can view

## UI Changes

**Departments page** (`src/routes/masters.departments.tsx`):
1. Add/Edit dialog gets a multi-select checkbox list of all worker categories
2. On save, insert selected category links into `department_categories`
3. Table shows a "Categories" column with badge chips for linked categories

**Daily Entry** (`src/routes/daily-entry.tsx`):
- When a department is selected, filter the category dropdown to only show categories linked to that department (fall back to all categories if none are linked)

## Technical Steps

1. **Migration**: Create `department_categories` table with foreign keys, unique constraint, and RLS policies
2. **Update `masters.departments.tsx`**: Fetch categories, add checkbox multi-select in dialog, save/load linked categories, display category badges in the table
3. **Update `daily-entry.tsx`**: Query `department_categories` to filter the category dropdown based on selected department
4. **Types**: Will be auto-updated after migration

