## Plan

Delete all contractor data for **BHELSTPP** and **IIPEVSKP** so the user can re-upload cleanly. The upload bug fix from the previous turn (project-scoped codes, in-CSV duplicate detection, per-row insert with toast warnings) is already in place — no code changes needed.

### Steps

1. **Safety check first.** Query `daily_manpower` and `worker_attendance` for any rows tied to contractors on these two projects. If found, stop and ask the user whether to also delete those (deleting contractors will cascade and remove the daily attendance records via the existing `ON DELETE CASCADE` foreign keys). We will not silently destroy attendance history.

2. **If safe (no attendance rows) or after user confirmation:**
   - Delete from `project_contractors` where `project_id IN (BHELSTPP, IIPEVSKP)`.
   - Delete the contractor master rows (`contractors`) that were linked **only** to those two projects and to no other project. Contractors still mapped to another project are left untouched.

3. **Verify** with a count query that both projects show 0 contractors, then tell the user to re-upload the two CSVs.

### Out of scope
- No schema changes.
- No changes to upload code, RLS, or any other functionality.
- No deletion of contractors that belong to other projects.
