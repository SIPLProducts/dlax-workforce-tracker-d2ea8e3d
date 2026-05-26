## What's actually happening

The 4 manpower rows for `DE-000038` are still `status='approved'` in the DB. The previous backfill did not stick for these rows (the sheet was likely auto-approved at some point via `submit_sheet`, then its sheet-level status was flipped back to `draft` without resyncing `daily_manpower.status`). Result: sheet shows "Draft / Editing", but RLS still blocks `DELETE` on the underlying rows because their per-row `status='approved'`. Delete is a silent no-op, re-insert hits the unique key, error.

The root cause is the brittle coupling: RLS keys edit permission off `daily_manpower.status`, but the source of truth is `daily_manpower_sheets.status`. They drift, and edits break.

## Fix — make the sheet status the source of truth

### 1. Migration: replace the DELETE and UPDATE RLS policies on `daily_manpower`

Drop the existing per-row-status gates and gate on the parent sheet's status instead. Editors (admin / supervisor / `daily_entry` edit) with project access can delete/update manpower rows whenever the parent sheet is `draft` or `rejected`. Approver paths (pending_l1 / pending_l2) are preserved.

```sql
DROP POLICY "Editors can delete editable manpower" ON public.daily_manpower;
DROP POLICY "Approvers and editors can update manpower" ON public.daily_manpower;

CREATE POLICY "Editors can delete editable manpower"
ON public.daily_manpower FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR (
    (has_role(auth.uid(), 'supervisor') OR has_screen_edit(auth.uid(), 'daily_entry'))
    AND has_project_access(auth.uid(), project_id)
    AND (
      sheet_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.daily_manpower_sheets s
        WHERE s.id = daily_manpower.sheet_id
          AND s.status IN ('draft','rejected')
      )
    )
  )
);

CREATE POLICY "Approvers and editors can update manpower"
ON public.daily_manpower FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR (
    (has_role(auth.uid(), 'supervisor') OR has_screen_edit(auth.uid(), 'daily_entry'))
    AND has_project_access(auth.uid(), project_id)
    AND (
      sheet_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.daily_manpower_sheets s
        WHERE s.id = daily_manpower.sheet_id
          AND s.status IN ('draft','rejected')
      )
    )
  )
  OR (status = 'pending_l1' AND is_project_l1(auth.uid(), project_id))
  OR (status = 'pending_l2' AND is_project_l2(auth.uid(), project_id))
);
```

### 2. Data backfill — sync `daily_manpower.status` to its parent sheet

Runs once to clean up rows that drifted (including `DE-000038`):

```sql
UPDATE public.daily_manpower dm
SET status = (CASE s.status
                WHEN 'draft' THEN 'draft'
                WHEN 'rejected' THEN 'rejected'
                WHEN 'approved' THEN 'approved'
                WHEN 'pending' THEN 'pending_l1'
              END)::approval_status
FROM public.daily_manpower_sheets s
WHERE dm.sheet_id = s.id
  AND dm.status::text <> (CASE s.status
                            WHEN 'draft' THEN 'draft'
                            WHEN 'rejected' THEN 'rejected'
                            WHEN 'approved' THEN 'approved'
                            WHEN 'pending' THEN 'pending_l1'
                          END);
```

### 3. No code change required

`handleSave` already inserts new rows with `status: 'draft'` (last turn). With the RLS gate now keyed off the sheet, the delete-then-insert flow works regardless of the per-row status that happens to be there.

## Out of scope

- No change to `submit_sheet` RPC, approval flow, or sheet-level policies.
- No change to the dedupe logic from earlier turns (still needed).
- No change to the `daily_manpower.status` column default.

## Verification

1. After migration, query `DE-000038` rows — RLS lets editors delete them even though `status='approved'` (sheet is draft).
2. Open `/daily-entry`, load `DE-000038`, edit a number, Save → succeeds.
3. Save again → still succeeds.
4. Submit for approval → `submit_sheet` promotes both sheet and rows; subsequent unauthorized edits remain blocked.
