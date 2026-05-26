## Root cause

The duplicate-key error on edit is NOT a duplicate row in the new batch — the dedupe fix from last turn is working. The actual problem is that the **delete-then-insert** strategy in `handleSave` silently fails to delete the old rows, leaving them in place. The next insert then collides with them on `(entry_date, project_id, contractor_id, department_id, category_id)`.

Why the delete is silent-failing: `daily_manpower.status` defaults to `'approved'` and the insert at `src/routes/daily-entry.tsx:501-512` **never sets `status`**. So every row written from the entry sheet is stored as `approved`, even though the parent `daily_manpower_sheets` row is `draft`.

The RLS policy `"Editors can delete editable manpower"` only allows DELETE when `status IN ('draft','rejected')`. With existing rows stuck at `approved`, the delete at lines 518-522 matches zero rows (no error, just a no-op under RLS). The fresh insert then duplicates the composite key and Postgres rejects it.

## Fix

Two coordinated changes — one code, one data backfill.

### 1. `src/routes/daily-entry.tsx` — set `status: 'draft'` on insert

In the `merged.set(key, { ... })` object inside `handleSave` (~line 501), add `status: 'draft'` so newly written rows are deletable on the next edit. Submission via `submit_sheet` RPC will continue to promote them to `pending_l1` / `approved` as it does today (no change to that flow).

### 2. Migration — backfill stuck rows

For every existing `daily_manpower` row whose parent `daily_manpower_sheets.status` is `draft` or `rejected`, set `daily_manpower.status` to match (`'draft'` or `'rejected'`). This unblocks edits on sheets that are currently in this broken state, including the one in the screenshot (`DE-000038`).

```sql
UPDATE public.daily_manpower dm
SET status = s.status::approval_status
FROM public.daily_manpower_sheets s
WHERE dm.sheet_id = s.id
  AND s.status IN ('draft','rejected')
  AND dm.status NOT IN ('draft','rejected');

-- Rows without a sheet_id link: infer from project+date
UPDATE public.daily_manpower dm
SET status = 'draft'
WHERE dm.sheet_id IS NULL
  AND dm.status = 'approved'
  AND EXISTS (
    SELECT 1 FROM public.daily_manpower_sheets s
    WHERE s.project_id = dm.project_id
      AND s.entry_date = dm.entry_date
      AND s.status IN ('draft','rejected')
  );
```

## Out of scope

- No change to the dedupe logic added last turn (still needed).
- No change to RLS policies, `submit_sheet` RPC, or approval flow.
- No change to the default of the `status` column (leave as `approved` — explicit insert covers it).

## Verification

1. Apply migration → existing `DE-000038` draft rows flip to `status = 'draft'`.
2. Open `/daily-entry`, load `DE-000038`, click edit, change a number, save → succeeds.
3. Save again → still succeeds (delete now matches old draft rows, insert is clean).
4. Submit for approval → rows promote through `pending_l1` → `approved` as before.
