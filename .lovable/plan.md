## Problem

`supabase/migrations/20260604080845_*.sql` was generated against the Lovable Cloud database and hardcodes two UUIDs (`45eaa690-…` project, `3b6ee1ca-…` and `d81269c7-…` contractors) that only exist there. On any fresh self-hosted install (and on any other environment), the `INSERT` violates the new FK because those contractor IDs don't exist locally. The `UPDATE` is similarly cloud-specific.

The schema part of the migration (adding the two FKs) is correct and portable — only the seed `UPDATE`/`INSERT` lines are broken.

## Fix

Rewrite the migration to be environment-agnostic: keep the FKs, drop the cloud-only data lines, and sweep orphans before adding the FKs so existing self-hosted DBs with stale join rows also succeed.

New content of `supabase/migrations/20260604080845_27c46ea4-197b-46a2-9c69-208ffa2a64b2.sql`:

```sql
-- Sweep orphans so the FKs can be added on any environment.
DELETE FROM public.project_contractors pc
 WHERE NOT EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = pc.contractor_id);

DELETE FROM public.project_contractors pc
 WHERE NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = pc.project_id);

ALTER TABLE public.project_contractors
  ADD CONSTRAINT project_contractors_contractor_id_fkey
  FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;

ALTER TABLE public.project_contractors
  ADD CONSTRAINT project_contractors_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
```

## Recovery steps for the self-hosted box that already failed

The failed migration left no partial state (it errored on the INSERT after the FKs were added in the same transaction, so Postgres rolled the whole file back). After pulling the rewritten file, simply re-run `install.sh` (or just the migration loop) and it will apply cleanly.

If a previous attempt did partially apply, you can manually drop the FKs and rerun:
```sql
ALTER TABLE public.project_contractors DROP CONSTRAINT IF EXISTS project_contractors_contractor_id_fkey;
ALTER TABLE public.project_contractors DROP CONSTRAINT IF EXISTS project_contractors_project_id_fkey;
```

## What is NOT changed

- The Lovable Cloud database already has those rows, so removing the seed lines has no effect there.
- All other migrations are untouched.
- No application code is affected — the FKs and schema shape are identical to what the original migration intended.