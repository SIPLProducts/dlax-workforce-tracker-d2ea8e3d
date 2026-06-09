## Problem

PC sees 219 "Available" contractors because RLS on `project_contractors` only returns rows for projects the PC has access to. The "assigned elsewhere" filter finds nothing, so every other contractor looks free. Admin sees the correct short list because their RLS returns all project_contractors rows.

## Fix

1. **New DB function** `public.get_globally_assigned_contractor_ids()` — `SECURITY DEFINER`, `STABLE`, returns `setof uuid` (distinct `contractor_id` from `project_contractors`). `GRANT EXECUTE` to `authenticated`. Exposes only contractor IDs — no project linkage, no other data.

2. **`src/components/ProjectAssignments.tsx`** — In `load()`, replace the contractors-only `allJoins` query (`supabase.from("project_contractors").select("contractor_id")`) with `supabase.rpc("get_globally_assigned_contractor_ids")`, and build the `assignedElsewhere` set from those IDs minus `assignedHere`. Departments/categories logic unchanged.

## Verification

Sign in as `projectcordinator1`, open Project Assignments → Testing → Contractors: Available drops from 219 to just the contractors not assigned to any project (matches Admin view). Admin behavior, Departments/Categories tabs, and all other screens/roles unchanged.
