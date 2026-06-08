# Auto-generated codes for Departments & Categories

## Schema (migration)
- Add `department_code text` to `public.departments` (unique, nullable for backfill safety).
- Add `category_code text` to `public.worker_categories` (unique, nullable).
- Create two sequences: `department_code_seq`, `category_code_seq`.
- Create two BEFORE INSERT triggers that, when the code is null/blank, assign:
  - `DEP-` + lpad(nextval, 3, '0')  → e.g. `DEP-001`
  - `CAT-` + lpad(nextval, 3, '0')  → e.g. `CAT-001`
- Backfill existing rows: assign codes in `created_at` order so older records get the lower numbers, then bump sequence past max.
- Codes are system-managed (no UI to edit), but column stays a plain text unique field so future manual overrides remain possible.

## UI changes
- `src/components/ProjectAssignments.tsx` — extend `KIND_CONFIG.masterLabel` for `departments` and `categories` to show `${code} — ${name}` when a code exists, falling back to just name. Update the `masterTable` select for departments/categories to fetch the new code columns (currently uses `select("*")`, so this is automatic — no change needed beyond label).
- No edits to Departments/Categories master screens (codes are auto-assigned and read-only). Optionally show the code in the master list tables — included as a small bonus column in `masters.categories.tsx` and `masters.departments.tsx` for visibility, no edit affordance.

## Out of scope
- Manual code editing UI.
- Renumbering / changing the `DEP-`/`CAT-` prefix scheme.
- Project-scoped uniqueness (codes are globally unique like a master record id).
