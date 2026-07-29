Update the dashboard's "No entry today" card so that the word "today" is replaced with the current date formatted as `dd-MMM-yyyy` (e.g., 29-Jul-2026).

## Change
- File: `src/routes/index.tsx`
- Compute a dynamic `todayLabel` with `date-fns` using the same `new Date()` reference used elsewhere on the dashboard.
- Update the `CardTitle` at line ~409 from:
  - `No entry today — {projectsWithoutToday.length} project(s)`
  - to: `No entry on {todayLabel} — {projectsWithoutToday.length} project(s)`

## Verification
- Open the dashboard preview and confirm the card title now reads something like "No entry on 29-Jul-2026 — 53 project(s)".
- Confirm the date updates if the system date changes (it is derived from `new Date()` on each render/data load).