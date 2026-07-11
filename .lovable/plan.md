## Diagnosis

Root cause of the empty Daily Entry / OT Entry screens: the assignment queries use **PostgREST embedded relations** (`department:departments(id,name)`, `category:worker_categories(...)`, `contractor:contractors(...)`), and on the self-hosted stack those nested objects come back as `null` — so the mapped arrays end up empty. Meanwhile the **Project Assignments** screen works because it never uses embedded relations: it queries the master table (`contractors` / `departments` / `worker_categories`) and the join table (`project_contractors` / `_departments` / `_categories`) as two separate reads, then joins in JS.

The self-hosted PostgREST doesn't reliably detect the FKs (schema cache) or apply grants through the embed. That's why counts show in the Assignments screen but the Data Entry / OT screens show "No departments or categories assigned to this project."

There is **no code-side limit on contractors per project**. The 55 you see all render in Project Assignments; the two `.limit(500)` values in Daily/OT Entry are on the *saved-sheets history table*, not contractors. Once the query pattern is fixed, all assigned contractors will appear.

## Fix

Match the pattern that already works in `ProjectAssignments.tsx`. In both `src/routes/daily-entry.tsx` and `src/routes/ot-entry.tsx`, replace each embedded-relation fetch with two parallel non-embedded fetches, then join client-side.

### `src/routes/daily-entry.tsx`

**Contractors fetch (around line 205):**
```ts
const [{ data: joins }, { data: masters }] = await Promise.all([
  supabase.from("project_contractors").select("contractor_id").eq("project_id", projectId),
  supabase.from("contractors").select("id,company_name,contact_number,work_place,contractor_code"),
]);
const idSet = new Set((joins || []).map((j: any) => j.contractor_id).filter(Boolean));
const list = (masters || []).filter((c: any) => idSet.has(c.id));
list.sort((a, b) => String(a.company_name || "").localeCompare(String(b.company_name || "")));
setContractors(list);
```

**Assignments fetch (around line 229):**
```ts
const [{ data: pd }, { data: pc }, { data: dc }, { data: dept }, { data: cat }] = await Promise.all([
  supabase.from("project_departments").select("department_id").eq("project_id", projectId),
  supabase.from("project_categories").select("category_id").eq("project_id", projectId),
  supabase.from("department_categories").select("department_id, category_id"),
  supabase.from("departments").select("id,name"),
  supabase.from("worker_categories").select("id,name,display_order"),
]);
const deptIds = new Set((pd || []).map((r: any) => r.department_id).filter(Boolean));
const catIds  = new Set((pc || []).map((r: any) => r.category_id).filter(Boolean));
const depts = (dept || []).filter((d: any) => deptIds.has(d.id));
const cats  = (cat  || []).filter((c: any) => catIds.has(c.id));
depts.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
cats.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || String(a.name || "").localeCompare(String(b.name || "")));
setAssignedDepts(depts);
setAssignedCats(cats);
setDeptCatLinks(dc || []);
```

### `src/routes/ot-entry.tsx`

Apply the exact same two changes at the analogous positions (lines ~268 for contractors and ~292 for assignments).

### No limits touched

No `.limit()` on contractor queries exists anywhere — nothing to remove. After the fix, all 55 (or any number of) assigned contractors will render.

## Verification

1. On the self-hosted deployment, open **Daily Entry** with the BHELSTPP project selected — table should list all 55 contractors with the Civil / Electrical department groups and their 3 category columns.
2. Open **OT Entry Sheet** — same list appears.
3. Assign a new contractor from Project Assignments → it appears live in Daily / OT Entry (realtime subscription is untouched).

Approve and I'll apply the two file edits.