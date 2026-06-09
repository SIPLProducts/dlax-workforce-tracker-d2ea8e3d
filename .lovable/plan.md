## Goal

Make User Management records findable from the existing Global Search (⌘K) and highlight the matched row when the user lands on `/users`, matching the behavior already used by Projects / Contractors / Departments / Categories.

The Amazon-style "results as you type" dropdown is already how Global Search works (see second screenshot) — no UX change is needed there. The only missing piece is the Users data source + highlight on the Users screen.

## Changes

### 1. `src/components/GlobalSearch.tsx`
- Add a `user` result kind: `{ kind: "user"; id: string; title: string; subtitle?: string }`.
- Extend `searchAll()` with a 6th parallel query against `profiles`, filtering with `or(login_id.ilike, display_name.ilike, email.ilike)`, ordered by `display_name`, limit 8. `id` = `profiles.user_id` (which is also the `TableRow key` on the Users screen).
  - `title` = `display_name || login_id || email`
  - `subtitle` = `[login_id, email].filter(Boolean).join(" · ")`
- Add a "Users" `CommandGroup` (icon: `User` from lucide-react) rendered after Sheets, only when results exist.
- In `handleSelect`, add a `case "user"` that navigates to `/users` with `search: { highlight: r.id }`.

### 2. `src/routes/users.tsx`
- Import and call `useHighlightRow(users)` inside `UsersPage`.
- Add `data-row-id={u.user_id}` to the `<TableRow>` in the Users tab (line 418). Other tabs are out of scope — global search lands on the Users tab which is the default.
- Add `validateSearch` to the route to accept an optional `highlight?: string` param (same pattern as the other masters routes), so the URL param is typed and preserved.

### 3. Permissions
No DB or RLS change. `profiles` is already readable by authenticated users via existing policies used elsewhere in this file. If a non-admin lacks access to a row, it simply won't appear in their search results.

## Verification

- Press ⌘K, type part of a user's login id / display name / email → "Users" group shows matches as you type.
- Selecting a result navigates to `/users?highlight=<user_id>`, the row scrolls into view and stays highlighted (existing `useHighlightRow` behavior — persists until click / key / navigation).
- Existing Projects / Contractors / Departments / Categories / Sheets search behavior is unchanged.

## Out of scope

- Redesigning the search dropdown UI (already Amazon-style).
- Searching Custom Roles, System Roles, or other tabs on the Users screen.
- Any RLS or schema change.
