## Root cause

The contractor master table has a **global** unique index on `contractor_code`:
`contractors_contractor_code_unique` (case-sensitive, applies across all projects).

The CSV upload (`handleUpload` in `src/routes/masters.contractors.tsx`) tries to reuse existing master contractors before inserting new ones, but the lookup is unreliable:

1. The lookup query combines `company_name.in.(...)` and `contractor_code.in.(...)` inside a single PostgREST `.or()` string. Names that contain commas, parentheses, or quotes (very common — e.g. "ABC Constructions, Pvt Ltd") break the `in.()` parser and the whole branch silently returns no matches.
2. The query has no error check — when it fails or returns partial data, code proceeds with an empty "reuse" map.
3. Code matching is **case-sensitive**, so `TL001` vs `tl001` is treated as new even though the DB unique index will still reject it.
4. Result: the CSV row's code already exists in the master table (e.g. uploaded earlier under BHELSTPP), the lookup misses it, the bulk `insert` hits `contractors_contractor_code_unique`, and the whole batch aborts with the raw DB message shown in the screenshot.

This is why uploading any CSV containing previously-seen contractor codes (very normal when the same workforce moves between projects) fails for IIPEVSKP.

## Plan

Edit only `src/routes/masters.contractors.tsx` — `handleUpload`. No schema or trigger changes.

1. **Robust existing-master lookup**
   - Replace the fragile `.or()` string with two safe `.in()` queries:
     - one on `contractor_code` for all non-empty CSV codes
     - one on `company_name` for all CSV names
   - Check `error` on each query and surface a friendly toast if either fails.
   - Build `byCode` / `byName` maps using **lowercased** keys so casing differences in the CSV don't cause false misses.

2. **Reuse before insert**
   - For each fresh CSV row, prefer match by `contractor_code` (lowercased), fall back to `company_name` (lowercased).
   - Only rows with no match go into `toCreate`.

3. **Insert new contractors safely**
   - Insert `toCreate` rows one batch at a time. If the batch fails with `23505` on `contractors_contractor_code_unique`, fall back to a per-row insert loop:
     - On per-row `23505`, re-query that code, pick up the existing master id, and add it to `idsToMap` instead of erroring.
   - This guarantees the upload completes even if another user added the same code between the lookup and the insert (or if the lookup missed it for any reason).

4. **Project assignment step (unchanged behaviour, friendlier error)**
   - Insert `project_contractors` rows for all resolved contractor ids.
   - The existing `UNIQUE (project_id, contractor_id)` already prevents in-project duplicates; on `23505` here, silently skip (already assigned) rather than abort the whole upload.

5. **User-facing messages**
   - Replace raw DB text like `duplicate key value violates unique constraint "contractors_contractor_code_unique"` with:
     - `Imported X contractors (reused Y existing, skipped Z duplicates).`
     - On hard failure: `Some rows could not be imported: <code1>, <code2>` (truncated).

## Out of scope

- No change to the global `contractors_contractor_code_unique` index — codes remain globally unique by design.
- No change to single-row "Add Contractor" `handleSave` (already handles this case).
- No change to the CSV template or column set.

## Technical notes

- File: `src/routes/masters.contractors.tsx`
- Function changed: `handleUpload` only (lines ~288–365)
- New behaviour requires no DB migration, no new RLS, no new RPC.
