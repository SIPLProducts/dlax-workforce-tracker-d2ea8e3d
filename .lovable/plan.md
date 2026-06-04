## Root cause

The Contractors page list query is:

```ts
supabase.from("project_contractors").select("contractor:contractors(*)").eq("project_id", projectId)
```

This returns **HTTP 400** from PostgREST:

> Could not find a relationship between 'project_contractors' and 'contractors' in the schema cache

Verified in DB: `project_contractors` has **no foreign key constraints at all** (only PK + UNIQUE(project_id, contractor_id)). Without a FK, PostgREST refuses to embed the related `contractors(*)` row, the request 400s, `items` stays empty, and the page shows "No contractors found" — even though the master rows exist.

The same missing FK also explains why some orphan mapping rows could be created against non-existent IDs in the past, and is the safer fix than a UI workaround.

## Fix

### 1. Migration — add the missing foreign keys

Add FKs to `public.project_contractors` so PostgREST can embed and the DB enforces referential integrity. Use `ON DELETE CASCADE` so deleting a contractor or project cleans up its mappings automatically (matches current UX: deleting a contractor on the master page should drop its project link).

```sql
ALTER TABLE public.project_contractors
  ADD CONSTRAINT project_contractors_contractor_id_fkey
  FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;

ALTER TABLE public.project_contractors
  ADD CONSTRAINT project_contractors_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
```

After this, the existing list query starts returning rows correctly — no frontend change needed.

### 2. Repair the two orphan contractor rows for the user

Both contractors exist in `contractors` but are not (correctly) mapped to the BHELSTPP project the user is working in. The user's selected project (per screenshot + network log) is `45eaa690-13ad-4fa7-934e-58196f2ab4e3` ("BHELSTPP — BHELSTPP").

- **Gunti Venkataswamy** (`d81269c7-c06f-4941-84f0-e0c63c59eb27`) is currently mapped to `69e5f2ca…` (the other "BHELSTPP — ED (KSK)" project, from a prior repair). Re-point it to `45eaa690…`.
- **Vemula Yedukondalu** (`3b6ee1ca-b0e4-43f5-bb40-a444165f5679`) has no mapping at all. Insert it.

```sql
UPDATE public.project_contractors
   SET project_id = '45eaa690-13ad-4fa7-934e-58196f2ab4e3'
 WHERE contractor_id = 'd81269c7-c06f-4941-84f0-e0c63c59eb27';

INSERT INTO public.project_contractors (project_id, contractor_id)
VALUES ('45eaa690-13ad-4fa7-934e-58196f2ab4e3',
        '3b6ee1ca-b0e4-43f5-bb40-a444165f5679')
ON CONFLICT DO NOTHING;
```

(The `UPDATE` goes in the same migration after the FK is added.)

### 3. Harden create flow — avoid future orphan masters

In `src/routes/masters.contractors.tsx` `handleSave`, if the `project_contractors` insert fails, the contractor master row is already inserted — leaving an orphan that never appears in any project list. Wrap with a compensating delete so the master row is removed on mapping failure, and re-throw the original error so the toast shows it:

```ts
const { data, error } = await supabase.from("contractors").insert(form).select("id").single();
if (error) throw error;
const newId = (data as any)?.id;
if (newId) {
  const { error: e2 } = await supabase
    .from("project_contractors")
    .insert({ project_id: projectId, contractor_id: newId });
  if (e2) {
    await supabase.from("contractors").delete().eq("id", newId); // rollback orphan
    throw e2;
  }
}
```

No other behavior changes.

## Out of scope

- Duplicate `projects` rows (there are two BHELSTPP entries and several other duplicates by code/name). Not touched here — separate cleanup.
- No RLS, schema, or other tab changes.
- No change to `ProjectAssignments.tsx` (the project-exclusivity filter we added previously stays as-is).

## Verification after apply

1. Reload `/masters/contractors`, select "BHELSTPP — BHELSTPP". Both Gunti and Vemula appear in the list and counters.
2. Add a new contractor — it appears immediately under that project, and not under others.
3. Switch to another project — list is empty (no leakage).
