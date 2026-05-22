## Problem

`pradeep` was assigned the **Management** custom role, but the database still has `supervisor` in `user_roles` for that user. As a result:

1. The sidebar shows **"Supervisor"** (it reads `roles` from `user_roles` only).
2. The previous cleanup migration ran before `pradeep` got the Management role, so it didn't catch this user — and any future user assigned a custom role will hit the same problem because `handleAssignCustomRole` no longer auto-grants `supervisor`, but it also doesn't *remove* an existing one.

Permission logic (`use-permissions.tsx`) is already correct — it ignores system-role baselines for non-admins who have a custom role. The remaining issue is purely about **stale system roles** + **UI label**.

## Fix

### 1. Strip non-admin system roles when a custom role is assigned
`src/routes/users.tsx → handleAssignCustomRole`: after inserting into `user_custom_roles`, delete all non-`admin` rows from `user_roles` for that user. Admins keep their admin role (so they can't lock themselves out).

### 2. One-off DB cleanup
Migration to remove any non-`admin` system role from users who currently have a custom role assigned. This clears pradeep's stale `supervisor` row.

### 3. Sidebar label reflects the effective role
`src/components/AppSidebar.tsx` (line 153): fetch the user's custom role name (via `user_custom_roles` + `custom_roles`) and show it. Fallback to system roles, else "No role".

  - Admin → show "Admin"
  - Else if custom role present → show custom role name (e.g. "Management")
  - Else → show system role(s)

### 4. Warn when adding a system role to a user who already has a custom role
`handleAddRole`: if the user already has a custom role and the admin is adding a non-`admin` system role, show a confirmation ("This will override the custom role's restrictions. Continue?"). Prevents accidental re-introduction of the same bug.

## Out of scope
- No change to permission merge logic (already correct).
- No change to RLS (already supports `has_screen_edit`).
- No change to custom role creation UI.

## Files

- `src/routes/users.tsx` — update `handleAssignCustomRole`, add guard in `handleAddRole`
- `src/components/AppSidebar.tsx` — display effective role
- New migration — cleanup stale `user_roles` for users with custom roles
