
## Goal

When clicking **View** on a record in Approvals (or anywhere a sheet list is shown), an OT sheet must open the OT Entry Sheet — not the Daily Entry Sheet — and the saved OT data for that project/date must render correctly. Daily Entry behavior is unchanged.

## Changes

### 1. `src/routes/approvals.tsx` — route View by sheet type
- Add `sheet_type` to the `Sheet` type and to the `daily_manpower_sheets` select.
- In the View button handler, branch:
  - `sheet_type === "ot"` → `navigate({ to: "/ot-entry", search: { project: s.project_id, date: s.entry_date, from: "daily" } })`
  - otherwise → existing `/daily-entry` navigation (unchanged).
- No other approvals logic changes.

### 2. `src/routes/ot-entry.tsx` — accept a `date` deep-link and load that sheet
- Extend `validateSearch` to also accept `date` as a `yyyy-MM-dd` string (optional).
- `OtEntryRoot` gate stays the same (`from === "daily"` shows the page; direct visits still show the landing card).
- In `OtEntryPage`:
  - If `search.date` is a valid `yyyy-MM-dd`, initialize `date` / `dateText` from it instead of yesterday; otherwise keep the current "yesterday" default.
  - Add a `useEffect` on `search.date` that, when present, sets `date` + `dateText` and keeps the date input read-only (so the "previous day fully locked" rule still holds for entry, and View-from-approvals lands on the correct day).
  - Existing loaders already filter on `sheet_type='ot'` + `entry_date`, so the saved OT rows, header fields (OT Hrs, Weather, Remarks), status badge, and approver/submitter info render automatically once `date` and `projectId` are set.
  - Mode resolution is unchanged: past-dated sheets open in `view` mode; the user can still click Edit if the sheet is editable and they have permission.

### 3. No DB or migration changes
- `sheet_type` already exists on `daily_manpower_sheets` and `daily_manpower`.
- Approval workflow, RLS, OT save flow, and the Daily Entry → OT prompt are untouched.

## Acceptance

- From **Approvals**, clicking the eye icon on a Daily sheet → opens `/daily-entry` for that project/date (unchanged).
- From **Approvals**, clicking the eye icon on an OT sheet → opens `/ot-entry` for that project/date, populated with the saved contractor rows, OT Hrs, Weather, Remarks, totals, and the correct status badge.
- Direct navigation to `/ot-entry` still shows the "No OT session active" landing card.
- Daily Entry → OT "Yes" prompt continues to open OT Entry for yesterday in edit mode.
