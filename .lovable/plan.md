## Goal
Remove the hardcoded **Security** and **Deficiency Manpower** columns from the Daily Entry Sheet. Keep **Weather** and **Remarks** as header-level fields. The category grid stays fully driven by Project Assignments.

## Changes

### `src/routes/daily-entry.tsx`
1. Remove from the entry table:
   - **Security** column (stop writing `security_count`)
   - **Deficiency Manpower** column (stop writing `deficiency_manpower`)
2. Keep:
   - **Weather** — header-level field, written to `weather_condition` on the anchor row per contractor
   - **Remarks** — header-level free-text, written to `remarks` on the anchor row per contractor
   - Sl.no, Name of Contractor, Contact No, Work Place (contractor identity)
   - One column per `(assigned department → assigned category via department_categories)`, grouped under the department header
   - "Other" group only if a project-assigned category isn't linked to any project-assigned department
   - Row Total + column Totals
3. Remove state, inputs, and handlers for security/deficiency. Save payload no longer includes those two fields.
4. Empty-state messaging stays.

### `src/routes/reports.tsx`
- Drop Security and Deficiency Manpower from any report rendering / Excel export. Weather and Remarks stay.

### Database
- **No migration.** `security_count` and `deficiency_manpower` columns stay on `daily_manpower` for historical rows; they just won't be written or displayed going forward.

## Out of scope
- Approval workflow, RLS, Project Assignments UI, `worker_attendance` — unchanged.
