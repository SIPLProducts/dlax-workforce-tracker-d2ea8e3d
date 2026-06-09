## Problem

Global Search currently covers Projects, Contractors, Departments, Categories, and Daily Entry Sheets — but not users from the User Management screen. Users want to search by User ID / display name / email and jump straight to the matched row in `/users` with the existing highlight ring.

## Change

### 1. `src/components/GlobalSearch.tsx`
- Extend the `Result` union with a `"user"` kind: `{ kind: "user"; id: string; title: string; subtitle?: string }`.
- In `searchAll`, add a parallel query against `profiles`:
  ```
  supabase.from("profiles")
    .select("user_id, login_id, display_name, email")
    .or(`login_id.ilike.${like},display_name.ilike.${like},email.ilike.${like}`)
    .order("login_id")
    .limit(LIMIT)
  ```
  Map each row to `{ kind: "user", id: row.user_id, title: row.display_name || row.login_id || row.email, subtitle: [login_id, email].filter(Boolean).join(" · ") }`.
- Add a `user` group to the `groups` memo and render a new `CommandGroup heading="Users"` using the existing `UserPlus` (or `User`) lucide icon, matching the style of other groups.
- In `handleSelect`, add a `case "user"` that navigates: `navigate({ to: "/users", search: { highlight: r.id } as any })`.
- Non-admins typically can't read other profiles via RLS, so results naturally scope themselves; no extra gating needed in the client.

### 2. `src/routes/users.tsx`
- Add `data-row-id={u.user_id}` to the `<TableRow>` in the Users tab (line ~418) so the highlight hook can find it.
- Import and call `useHighlightRow(users.map(u => ({ id: u.user_id })))` inside `UsersPage`, mirroring how other masters screens use it.
- No change to permissions, fetching, or layout.

### 3. No other changes
- `use-highlight-row.ts` already supports persistent highlight + dismiss-on-interaction — reuse as-is.
- No DB / RLS / migration changes.
- No route, sidebar, or styling changes.

## Verification

- Open Global Search (⌘K), type a login ID / display name / email substring → a "Users" group appears with matching profiles.
- Selecting a user navigates to `/users`, the matching row scrolls into view and shows the persistent ring highlight.
- Clicking elsewhere / pressing a key / navigating away clears the highlight and removes `?highlight=` from the URL.
- Non-admins (no access to `/users`) either see no user results (RLS) or are blocked by `ScreenGuard` on arrival — no regression.

## Out of scope

- No changes to the System Roles / Custom Roles tabs (search targets the Users tab only).
- No new search filters, no fuzzy ranking changes, no styling token changes.
