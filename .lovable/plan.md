## Root cause

Two separate issues are causing the missing rows:

### 1. IIPEVSKP (41 of 43 CSV rows)
The CSV itself contains bad rows that are silently dropped:
- One row with no `contractor_code` and no `company_name` (only a phone number on the line with `9676487650`) — has nothing to insert.
- Code `TL0012` appears twice with two different companies (`Muthyala rao` and `K.Bhavani`). The current code treats the second one as a duplicate of the first and drops it.

So 43 CSV lines collapse to 41 in DB. This matches what's on screen.

### 2. BHELSTPP (53 of 54 CSV rows)
Row `SC9127, Lucky Roy, Debashish Biswas` is completely missing from the database (not on any project). It was lost during an earlier upload that hit the global `contractors_contractor_code_unique` constraint and aborted that batch before the per-row recovery path existed.

### 3. Underlying architectural issue (user's main request)
Today contractors are **global masters** with a unique `contractor_code` across the whole system. That's why the same code coming from two different projects collides, why we ever needed "reuse existing master" logic, and why a code typed twice on two projects can erase a real contractor.

The user wants the opposite model: **contractors belong to a project**, and the same code can exist on multiple projects without being considered a duplicate. Duplicate detection must only apply inside the same project.

## Plan

### A. Schema migration (per-project contractors)

1. Drop the global unique index `contractors_contractor_code_unique`.
2. Add a partial unique index on `project_contractors(project_id, contractor_id)` (already there — keep) and a new partial unique index `UNIQUE (project_id, lower(contractor_code))` enforced by trigger so two rows on the same project can't share a code. The existing `enforce_unique_contractor_code_per_project` trigger already does this — keep it and verify it fires on `project_contractors` insert/update.
3. Add a `project_id` column to `contractors` (nullable for now), backfill it from the single `project_contractors` row each master currently has, and add an index on `(project_id, lower(contractor_code))`. Contractors that are genuinely shared across projects today (if any) stay with `project_id NULL` and continue working via `project_contractors`.
4. No data is deleted. No RLS changes. No new tables.

### B. Upload logic (`src/routes/masters.contractors.tsx → handleUpload`)

1. **Stop reusing masters across projects.** For each CSV row, always create a **new** `contractors` row scoped to the current project, then link it via `project_contractors`. This is what the user explicitly asked for.
2. **In-project dedupe only.** Before insert, look up existing contractors for **this project only** by lowercased `contractor_code` and lowercased `company_name`. If found, update that row instead of inserting (so re-uploading the same CSV keeps the row, doesn't create a second one).
3. **Preserve CSV rows that share a code only by accident across projects.** Because the lookup is now project-scoped, `SC9127` on BHELSTPP and `SC9127` on IIPEVSKP coexist as two independent rows.
4. **Within a single CSV, surface bad rows instead of silently dropping them.**
   - Empty `contractor_code` AND empty `company_name` → skip with a toast listing the row numbers.
   - Same `contractor_code` repeated inside the CSV → import the first, list the rest in a toast as "skipped duplicates in CSV: row X (TL0012), row Y (TL0012)" so the user can fix the source file. Do not merge them silently.
5. **No 23505 fallback needed anymore** once the global unique index is gone. Keep one defensive `try/catch` per row so a single bad row never aborts the whole upload, and collect failed codes into the final summary toast.
6. **Final toast** stays informative: `Imported X new, updated Y existing in this project, skipped Z CSV rows (see console for details)`.

### C. Repair the two affected projects

1. After the migration ships, ask the user to re-upload `bhelstppprojectcontractors.csv` and `IIPEVSKPProjectcontructors.csv`. With the new logic:
   - BHELSTPP picks up the missing `SC9127`.
   - IIPEVSKP picks up the second `TL0012` (K.Bhavani) as its own row; the empty row is still skipped with a clear message.
2. No automatic backfill from the CSVs on the server — the user re-uploads through the existing UI so they see exactly what happened.

## Out of scope

- No changes to the `ProjectAssignments` "shared contractor" UI — that path already inserts/links per project and will keep working with project-scoped rows.
- No changes to single-row "Add Contractor" dialog except to drop the global-code error message and rely on the per-project trigger.
- No changes to reporting, approvals, daily entry, or RLS.

## Technical notes

- Migration file: new SQL migration dropping `contractors_contractor_code_unique`, adding `contractors.project_id`, backfilling, and adding the per-project index.
- File: `src/routes/masters.contractors.tsx` — rewrite `handleUpload` per section B; small tweak to `handleSave` to remove the global-uniqueness assumption.
- Verification: after migration, run a SELECT to confirm BHELSTPP=54 rows is achievable on re-upload and IIPEVSKP imports 42 valid rows (43 minus the truly empty line) with a toast listing the duplicate `TL0012` in the CSV.
