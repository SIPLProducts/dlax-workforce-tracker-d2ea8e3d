## Goal
In the Daily Entry Sheet, show **only** the contractors, departments, and categories that have been assigned to the selected project via Masters → Project Assignments. Today the screen silently falls back to the global Masters pool when a project has no assignments, which leaks unrelated records.

## Scope
Single file: `src/routes/daily-entry.tsx`. No DB, RLS, or schema changes. No change to the hardcoded CIVIL/MEP/NMR column groups in the entry grid (those are static columns, not master-driven).

## Changes

### 1. Contractors list — strict project scope (lines ~159–181)
Current behavior: queries `project_contractors`; if empty, falls back to **all** contractors.

New behavior: always query `contractors` filtered by IDs from `project_contractors` for the selected `projectId`. If the project has no assigned contractors, set `contractors` to `[]`.

```ts
const fetchContractors = async () => {
  if (!projectId) { setContractors([]); return; }
  const { data: joins } = await supabase
    .from("project_contractors")
    .select("contractor_id")
    .eq("project_id", projectId);
  const ids = (joins || []).map((j: any) => j.contractor_id);
  if (ids.length === 0) { setContractors([]); return; }
  const { data } = await supabase
    .from("contractors")
    .select("id,company_name,contact_number,work_place")
    .in("id", ids)
    .order("company_name");
  setContractors(data || []);
};
```

Keep the existing realtime channel subscriptions on `contractors` and `project_contractors` so the list updates when assignments change.

### 2. Departments & Categories — strict project scope on save (lines ~331–349 in `handleSave`)
Current behavior: tries `project_departments` / `project_categories` first, then falls back to the first row from the global `departments` / `worker_categories` tables.

New behavior: only use project-assigned rows. If either is missing, block the save with a clear toast pointing the user to Project Assignments.

```ts
const [{ data: assignedCats }, { data: assignedDeps }] = await Promise.all([
  supabase.from("project_categories").select("category_id").eq("project_id", projectId).limit(1),
  supabase.from("project_departments").select("department_id").eq("project_id", projectId).limit(1),
]);
const fallbackCat = (assignedCats?.[0] as any)?.category_id as string | undefined;
const fallbackDep = (assignedDeps?.[0] as any)?.department_id as string | undefined;
if (!fallbackCat || !fallbackDep) {
  setSaving(false);
  return toast.error("Assign at least one Department and one Category to this project in Masters → Project Assignments.");
}
```

Remove the two global fallback queries against `departments` and `worker_categories`.

### 3. Empty-state copy (line ~602)
Update the empty contractor row message from
"No contractors. Add some in Masters → Contractors."
to
"No contractors assigned to this project. Assign some in Masters → Project Assignments."

## Out of scope
- The visible category columns (Rod Bending, Mason, Plumbers, etc.) are hardcoded `GROUPS` constants and are not driven by the `worker_categories` table; they remain unchanged.
- Reports, Approvals, and Masters screens are not touched.
- No changes to RLS policies — `has_project_access` already gates row-level access; this change just stops the UI from offering non-assigned masters.

## File touched
- `src/routes/daily-entry.tsx`
