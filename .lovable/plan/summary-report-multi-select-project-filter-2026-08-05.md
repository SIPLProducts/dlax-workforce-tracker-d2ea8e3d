# Summary Report: multi-select Project filter

Make the Project field in Reports → Summary Report a checkbox multi-select, so several projects can be picked at once. Everything else on the screen stays as it is.

## Behaviour

- Dropdown lists all projects with a checkbox each, plus an "All Projects" row at the top.
- Searchable, same as today.
- Trigger label: "All Projects" when nothing is checked, the project name when one is checked, "N projects selected" for more.
- Selecting "All Projects" clears the individual selections.
- Summary table, totals, week averages, Excel export and Matrix Format export all reflect the selected set.
- Other tabs (Daily, Daily Labour Report, Weekly) and their filters are untouched.

## Technical notes

- Add a reusable `ProjectMultiCombobox` component (Popover + Command + Checkbox), mirroring the multi-select already used on the Dashboard, so the pattern is shared rather than duplicated inline.
- In `SummaryTab` (`src/routes/reports.tsx`): replace `projectId: string` state with `projectIds: string[]` (empty = all).
  - Query: use `.in("project_id", projectIds)` when non-empty, otherwise no project filter.
  - Row seeding: seed from all projects when empty, else only selected ones.
  - Update the effect and memo dependency arrays to the new state.
- Export filenames and workbook structure unchanged.
