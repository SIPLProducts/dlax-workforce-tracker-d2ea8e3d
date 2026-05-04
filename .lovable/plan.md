## Goal

Make `/masters/approvals` a fully configurable Approval Settings screen with built-in project creation.

## 1. Add Project (quick-add on this screen)

- New **"+ Add Project"** button in the page header
- Opens a dialog with all project fields:
  - Name *, Code, Location, Division, Project Group, Start Date, Status (Active/On Hold/Completed)
- Validated with Zod (name required, max lengths)
- On save → insert into `projects`, refresh list, scroll to new row
- Newly added project appears with approval **disabled** by default (admin can enable + assign approvers inline)

## 2. Search, Filter, Sort

Toolbar above the project list:
- **Search box** — filters by project name / code (live)
- **Status filter** — All / Approval Enabled / Approval Disabled / Has L1 Missing / Has L2 Missing
- **Sort dropdown** — Name (A→Z / Z→A), Code, Recently Added, Approval Enabled first

## 3. Show/Hide Columns

- "Columns" dropdown menu with checkboxes for: Code, Name, Status, Approval Enabled, L1 (PC), L2 (PM), Last Updated, Actions
- Preference saved in `localStorage` per user
- View switches between **Card view** (current) and **Table view** (new compact mode) — toggle button. Table view honors column visibility.

## 4. Inline Edit + Per-Row Save

- Each row's switch (Enable) and L1/L2 dropdowns are inline-editable (already partially there)
- "Save" button per row; also a global **"Save All Changed"** at top showing dirty count
- Visual marker (dot / "Modified") on dirty rows

## 5. Bulk Apply

- Checkbox on each row + "Select all (filtered)"
- Bulk actions bar appears when ≥1 selected:
  - Enable approval / Disable approval
  - Set L1 → user picker
  - Set L2 → user picker
  - Apply to N selected projects (single confirmation)

## 6. Edit Existing Project

- Pencil icon on each row → opens same dialog used for Add, prefilled
- Delete protected: only if no `daily_manpower` rows reference it (admin-only, with confirmation)

## Technical Notes

- Reuse `projects` table (already has all fields) — no DB change
- Existing RLS already allows admin INSERT/UPDATE/DELETE on `projects`
- No changes to `project_approval_config` schema; only UI improvements
- Column visibility + view mode persisted in `localStorage` key `dlax.approvals.prefs`

## Out of Scope

- Project deletion when entries exist (just block with toast)
- Importing projects via CSV (separate ask)