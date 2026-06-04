## Root cause

The newly created contractor **Lucky Roy** (`8f17ffc7-5d61-4f97-9e76-3046b4e17138`) exists in `contractors` but has **no row in `project_contractors`** — so the list query on `/masters/contractors` (which joins via `project_contractors` filtered by project) returns nothing for UNITVSKP. This is the same orphan-master pattern we hit previously, before the create-flow rollback was added.

The list query itself is fine now (FKs were added in the prior migration). The only fix needed is to insert the missing mapping row.

The user's selected project is "UNITVSKP — UNITVSKP" → `febad4f1-cb28-4d68-b587-edd932615af7` (there is also a duplicate `UNITVSKP — MD(KAK)` at `45f25dbd…`, which is out of scope).

## Fix

Run a single data insert to map Lucky Roy to UNITVSKP:

```sql
INSERT INTO public.project_contractors (project_id, contractor_id)
VALUES ('febad4f1-cb28-4d68-b587-edd932615af7',
        '8f17ffc7-5d61-4f97-9e76-3046b4e17138')
ON CONFLICT DO NOTHING;
```

No code changes. The `handleSave` rollback added previously already prevents new orphans going forward; this row was created before that fix and just needs repair.

## Verification

Reload `/masters/contractors` with UNITVSKP — UNITVSKP selected. Lucky Roy appears in the list, counters update, and the contractor is not visible under any other project.

## Out of scope

- Duplicate UNITVSKP project rows — separate cleanup.
- No schema, RLS, or component changes.
