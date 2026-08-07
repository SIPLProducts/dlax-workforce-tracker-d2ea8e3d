# Show Project Name only (drop "[CODE] Name" labels)

Everywhere a project is displayed as a combined code + name label, show just the project name. Dedicated "Code" columns in report tables and Excel/PDF exports stay unchanged.

## Changes

1. **`src/components/ProjectCombobox.tsx`**
   - Default label format returns `p.name` only. Keep code in the searchable `value` string so search-by-code still works.

2. **`src/components/ProjectMultiCombobox.tsx`**
   - `fmt` returns `p.name` only (trigger label and list rows). Keep code in the item `value` for search.

3. **`src/routes/reports.tsx`**
   - Remove the `formatLabel` overrides that prepend `[code]` for the Daily, Daily Labour Report and Weekly project pickers.
   - Daily tab grouping label (`byProject`): use project name only.
   - Summary matrix: row label uses name only; on-screen code badge next to the project name removed (the separate Code column stays).
   - Weekly Report header line under the title shows the project name only.
   - Export filenames continue to use code when available (no user-visible label change).

4. **`src/routes/index.tsx`** (Dashboard)
   - Project multi-select trigger label, list rows, top-project rows, status-card project badges/lists and table project cells show the project name only. Code stays in search values.

## Out of scope

- Sorting stays as-is (code-then-name sort keys unchanged).
- Table/Excel/PDF `Code` columns, data fetching, filters and totals unchanged.
