## Goal
Add a "Select All" option to the project filter in the **Daily Labour Report** tab so users can preview and download data for all projects at once. Existing single-project behaviour and all other report tabs remain unchanged.

## Current state
- `src/routes/reports.tsx` has a `DlrTab` component that only supports one selected project via `ProjectCombobox` (no `includeAllOption` prop).
- `src/lib/dlr-daily.ts::getDlrDailyMatrix()` builds a matrix for exactly one project row.
- `src/components/DlrDailyPreview.tsx` already renders multiple rows and group headers, so it can display a combined matrix once one is produced.
- Matrix Format export (`src/lib/dlr-daily-matrix.ts`) currently emits one sheet for a single project.

## Changes

### 1. `src/routes/reports.tsx` — DlrTab
- Change `projectId` state default from `""` to `"all"`.
- Pass `includeAllOption` and `allLabel="All Projects"` to `ProjectCombobox`.
- Update the data fetch:
  - Keep date filter.
  - Add `projects(id, code, name, project_group)` to the select so rows carry project identity.
  - When `projectId === "all"`, do **not** apply a project filter.
  - When a specific project is selected, keep the existing `.eq("project_id", projectId)` filter.
- Build a list of projects to render (all projects for "all", or the single selected project).

### 2. `src/lib/dlr-daily.ts` — multi-project matrix
- Update `DlrInput` to accept `projects: Project[]` instead of a single `project`.
- Update `getDlrDailyMatrix()` to:
  - Accept the new input shape.
  - Group rows by project, then by project_group.
  - Emit one group header row per distinct `project_group` (only when the group value exists).
  - Emit one data row per project, sorted by project name/code.
  - Keep the same header band structure and column layout.
- Update `DlrMatrix` type to support multiple data rows (it already does structurally; only the generator changes).
- Keep `downloadDlrXlsx()` and `downloadDlrCsv()` unchanged — they already operate on the matrix cells.

### 3. `src/lib/dlr-daily-matrix.ts` — Matrix Format export for all projects
- Update `downloadDlrMatrixXlsx()` to accept an array of per-project matrices (or a single combined matrix plus project list).
- For a single project: behaviour identical to today (one sheet).
- For "Select All": generate one sheet per project in the same workbook, each sheet named by project code/name and preserving the reference template formatting.

### 4. `src/routes/reports.tsx` — wiring and UI text
- Update the `matrix` memo to call the new `getDlrDailyMatrix()` with the project list.
- Update the empty-state message and file base name for the "all projects" case.
- Ensure the Excel, Matrix Format, and CSV buttons remain disabled until data is ready.

## Verification
- Open `/reports` → Daily Labour Report tab.
- Confirm "All Projects" appears in the project combobox and is selectable.
- With "All Projects" selected, the preview table lists every project that has approved data for the chosen date.
- Selecting a single project still shows only that project, identical to today.
- Excel and CSV downloads contain the combined data; Matrix Format download contains one correctly formatted sheet per project.

## Files to modify
- `src/routes/reports.tsx`
- `src/lib/dlr-daily.ts`
- `src/lib/dlr-daily-matrix.ts`

No database, auth, or other report-tab changes are required.