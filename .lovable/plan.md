## Root cause

The contractors were never deleted. A bulk CSV upload of 54 rows was committed at `2026-06-04 10:42:22+00` against project **BHELSTPP** (not UNITVSKP). The Contractors page remembers the last-selected project in `localStorage`, so if BHELSTPP was active when Upload was clicked, every row was attached to BHELSTPP. UNITVSKP only ever received the single `Lucky Roy / SC9127` row.

The two `UNITVSKP`-coded projects are **legitimately different** (names `MD(KAK)` and `UNITVSKP`) — they will be kept as-is. The dropdown just needs to show the name clearly so they can be told apart.

## What to change

### 1. Show project name (not just code) in the dropdown
On `src/routes/masters.contractors.tsx`, render each option as `<name> — <code>` (e.g. `MD(KAK) — UNITVSKP` vs `UNITVSKP — UNITVSKP`) so two projects sharing a code are visually distinct.

### 2. Confirmation prompt before CSV upload
In `handleUpload`, after parsing the CSV and before inserting, show a confirm dialog:

> Import **N** contractors into project **"<name> — <code>"**?

This prevents a stale `localStorage` selection from silently sending rows to the wrong project.

### 3. Show destination project on the Add Contractor dialog
Append the active project name to the dialog title (e.g. `Add Contractor — MD(KAK) (UNITVSKP)`) so manual single-row entry has the same safeguard.

### 4. Optional one-off data fix
If you confirm, copy the 54 BHELSTPP `project_contractors` rows into the correct UNITVSKP project (your choice of `MD(KAK)` or `UNITVSKP`). Same `contractor_id`s, new project assignment — masters stay intact and BHELSTPP keeps its rows.

## Out of scope

- No deletion or merging of the two UNITVSKP projects — they are different projects.
- No schema changes. Existing unique index `project_contractors(project_id, contractor_id)` and the `enforce_unique_contractor_code_per_project` trigger already behave correctly.

## Files touched

- `src/routes/masters.contractors.tsx` — dropdown label, upload confirm, dialog title.
- (Optional) one data-fix insert to copy BHELSTPP assignments into the chosen UNITVSKP project.

## Question before I implement

1. Do you want me to **copy** the 54 BHELSTPP contractor assignments into UNITVSKP as well, or leave the data alone and you'll re-upload under the correct project?
2. If copying — which target: `MD(KAK)` (id `45f25dbd…`) or `UNITVSKP` (id `febad4f1…`)?
