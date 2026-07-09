## Problem

On the self-hosted server, Daily Entry and OT Entry show no contractor rows even though Project Assignments shows all 97 contractors, 5 departments, and 49 categories are assigned to the project (GENMNGR). The screenshot of Daily Entry confirms the category header columns render (so category loading works), but the body table has no rows — meaning the contractor fetch is returning empty.

## Root cause

Both `src/routes/daily-entry.tsx` and `src/routes/ot-entry.tsx` load contractors in a two-step pattern:

1. Fetch all `project_contractors` rows for the project → collect ~97 contractor UUIDs.
2. Call `supabase.from("contractors").select(...).in("id", [<97 UUIDs>])`.

Step 2 turns into a GET request with a query string containing all 97 UUIDs (~3.7 KB just for the `id=in.(...)` filter). Self-hosted Kong / PostgREST on the customer's stack rejects or truncates URLs this long — the same class of failure we already hit and fixed on the Project Assignments screen (the earlier 502 with 104 UUIDs). Managed Supabase tolerates the long URL, so it works in preview but fails in the self-hosted deployment: the request errors out and the code falls into the empty-array branch silently.

The same pattern exists for departments (`.in("id", deptIds)`) and categories (`.in("id", catIds)`); Assignments UI shows 49 assigned categories, which will also blow the URL budget.

## Fix

Replace the two-step "fetch IDs then `.in(...)`" with a single embedded-relation query for each of the three lists, matching the pattern already used elsewhere. This keeps the URL short (one `project_id=eq.<uuid>` filter) and lets PostgREST return the joined master rows in one round trip.

Files: `src/routes/daily-entry.tsx` and `src/routes/ot-entry.tsx` — the two `useEffect` blocks that load contractors and assignments (lines ~199–260 in daily-entry, ~261–320 in ot-entry).

New shape for contractors:

```ts
supabase
  .from("project_contractors")
  .select("contractor:contractors(id,company_name,contact_number,work_place,contractor_code)")
  .eq("project_id", projectId);
// then map rows -> row.contractor, filter nulls, sort by company_name in JS
```

New shape for departments and categories (single query each):

```ts
supabase
  .from("project_departments")
  .select("department:departments(id,name)")
  .eq("project_id", projectId);

supabase
  .from("project_categories")
  .select("category:worker_categories(id,name,display_order)")
  .eq("project_id", projectId);
```

`department_categories` (all links) stays as-is — it's a small global table, no `.in()` involved.

State setters, downstream logic, realtime subscriptions, and UI remain unchanged. Only the fetch shape changes.

## Verification

After the change, on the self-hosted server the Daily Entry and OT Entry screens for the GENMNGR project should render all 97 assigned contractors as rows, with all 5 department groups and 49 category columns in the header — matching what Project Assignments already shows.

## Out of scope

No schema, RLS, or Kong/nginx changes are required — the assignment data already exists in the DB and Project Assignments proves it is readable. This is purely a client-side query refactor.