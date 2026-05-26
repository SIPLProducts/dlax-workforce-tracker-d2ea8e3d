## Goal
Make the Project dropdown searchable (type-to-filter by code or name) on every screen that has one.

## Approach
Add a small reusable `ProjectCombobox` component using the existing shadcn `Popover` + `Command` primitives (already in the project). Same trigger style as the current `Select` (full-width button showing `CODE — Name`), but the panel has a search input and filtered list. Swap it in for the current `<Select>` project picker on each screen.

## Changes

1. **`src/components/ProjectCombobox.tsx`** (new)
   - Props: `value: string`, `onChange: (id: string) => void`, `projects: { id: string; name: string; code: string | null }[]`, optional `placeholder`, `includeAllOption?: boolean` (for Reports' "All Projects"), `disabled?: boolean`, `className?: string`.
   - Uses `Popover` + `Command` + `CommandInput` + `CommandList` + `CommandEmpty` + `CommandItem`.
   - Filter matches `code` or `name` (case-insensitive).
   - Selected display: `CODE — Name` (matches current format).

2. **Swap in** the new combobox on these screens (no logic changes):
   - `src/routes/daily-entry.tsx` (line ~662)
   - `src/routes/masters.assignments.tsx` (line ~34) — Project Assignments
   - `src/routes/reports.tsx` (line ~300) — with `includeAllOption`
   - Approvals page has no project filter dropdown, so no change there.

## Out of scope
- No backend / schema changes.
- No changes to other dropdowns (contractor, department, etc.) — only the Project picker as the user asked.
- Reports' other filters and the project-group cascade behavior remain identical.
