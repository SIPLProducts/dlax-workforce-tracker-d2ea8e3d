## Problem

Global Search shows the same record multiple times — e.g. "KVV Satyanarayana Works Contractor (SC8687)" appears twice. Root cause: the underlying tables contain real duplicate rows (same `company_name` + `contractor_code` with different `id`s). The current `searchAll` in `src/components/GlobalSearch.tsx` pushes every row returned by Supabase straight into the results list, so any logical duplicate in the data is shown to the user.

This affects all kinds (projects, contractors, departments, categories, users), not just contractors, since the same pattern is used for each.

## Change

### `src/components/GlobalSearch.tsx` — application-level dedup per kind

After fetching each result set and before pushing into `out`, filter rows through a per-kind `Set<string>` keyed by a normalized identity (lowercased, trimmed). First occurrence wins; later duplicates are skipped.

Dedup keys per kind:
- **project**: `code || name`
- **contractor**: `contractor_code || company_name`
- **department**: `department_code || name`
- **category**: `category_code || name`
- **sheet**: `sheet_code` (already unique, but keep for safety)
- **user**: `login_id || email || user_id`

Implementation shape:

```ts
const seen: Record<string, Set<string>> = {
  project: new Set(), contractor: new Set(), department: new Set(),
  category: new Set(), sheet: new Set(), user: new Set(),
};
const norm = (v?: string | null) => (v || "").trim().toLowerCase();
const take = (kind: string, key: string) => {
  if (!key) return true; // no identity → don't dedup
  if (seen[kind].has(key)) return false;
  seen[kind].add(key);
  return true;
};
```

Wrap each existing `.forEach` push with a `take(...)` guard.

### Out of scope

- No DB cleanup of duplicate rows (data fix is a separate concern).
- No changes to dropdown layout, styling, or navigation.
- No changes to per-page lists (this is search-only).

## Verification

- Search "kv" → "KVV Satyanarayana Works Contractor (SC8687)" appears exactly once under Contractors.
- Other kinds (projects, users, etc.) also collapse to one row per code/name.
- Selecting a result still navigates and highlights correctly (uses the first row's `id`).
