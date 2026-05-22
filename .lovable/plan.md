# Goal

Make custom roles fully dynamic: if a custom role grants **Edit** on a screen, the user with that role should be able to both **open** the screen and **perform all its actions** (create/update/delete) — without needing the system `admin` role.

# Root cause

Two layers are still hard-coded to `hasRole("admin")`:

1. **Page-level UI gates** — `users.tsx` and `masters.approvals.tsx` block the page body when the user isn't system admin (that's why you see "You don't have permission" even though the sidebar link shows).
2. **Database RLS policies** — `profiles`, `user_roles`, `user_projects`, `project_approval_config` all use `has_role(auth.uid(), 'admin')`. So even if we open the page, inserts/updates/deletes would fail silently for a custom-role user.

Both layers must change for true dynamic permissions.

# Fix

## 1. Database migration — permission-aware RLS

Use the existing `has_screen_edit(user_id, screen_key)` helper. Replace admin-only policies on the relevant tables with `admin OR has_screen_edit(...)`.

- **`profiles`** — `ALL` policy: `has_role(admin) OR has_screen_edit(auth.uid(), 'user_management')`
- **`user_roles`** — `ALL` policy: same as above, with one safeguard: a non-admin **cannot** insert/update a row where `role = 'admin'` (prevents privilege escalation). Implement as two policies: one for non-admin rows (custom-role users allowed), one for admin rows (system admin only).
- **`user_projects`** — `ALL` policy: `has_role(admin) OR has_screen_edit(auth.uid(), 'user_management')`
- **`project_approval_config`** — `ALL` policy: `has_role(admin) OR has_screen_edit(auth.uid(), 'masters_approval_config')`
- **`projects`** insert/update/delete** — `has_role(admin) OR has_screen_edit(auth.uid(), 'masters_projects')`
- **`contractors`** ALL — `... OR has_screen_edit(..., 'masters_contractors')`
- **`departments`** ALL — `... OR has_screen_edit(..., 'masters_departments')`
- **`worker_categories`** ALL — `... OR has_screen_edit(..., 'masters_categories')`
- **`department_categories`** ALL — `... OR has_screen_edit(..., 'masters_categories')`
- **`custom_roles`** + **`role_screen_permissions`** + **`user_custom_roles`** — kept admin-only (only true admins can mint new roles or grant roles to users; otherwise a custom role could escalate itself).
- **`has_project_access`** function — extend so a user with `has_screen_edit(_, 'user_management')` who has no project assignments sees all projects (mirrors the existing admin behavior). This lets dynamic admins manage data across projects.

## 2. UI — replace `hasRole("admin")` page gates with `canEdit(screenKey)`

- **`src/routes/users.tsx`**
  - Import `usePermissions`.
  - `const canManageUsers = isAdmin || canEdit("user_management")`.
  - Use `canManageUsers` for the load `useEffect` guard (line 120-121) and the "no permission" early return (line 318).
  - **Keep `isAdmin`-only** for the "grant system admin role" UI (lines 404, 618) — only true admins can promote others to admin.

- **`src/routes/masters.approvals.tsx`**
  - Import `usePermissions`.
  - `const canManageApprovals = isAdmin || canEdit("masters_approval_config")`.
  - Use it for the load `useEffect` (line 182) and the early return (line 370).

- Other master screens (`projects`, `contractors`, `departments`, `categories`) — already gated only by `ScreenGuard` + RLS, so they'll start working as soon as RLS is updated. No code change needed there.

## 3. Out of scope

- `approvals.tsx` page (approval-flow logic stays role-based by design — L1/L2 approvers are project-specific, not screen-permission-based).
- Creating/editing custom roles & assigning roles stays admin-only (security boundary).
- No new screens, no changes to permission UI.

# Files touched

- New SQL migration (RLS rewrites + `has_project_access` update).
- `src/routes/users.tsx`
- `src/routes/masters.approvals.tsx`

# Security notes

- A custom role with `user_management = edit` will be able to create users, assign non-admin roles, and assign project access — same powers as today's admin **except** they cannot grant the `admin` system role and cannot create/edit custom roles themselves. This prevents privilege escalation while making the permission model truly dynamic.
- All checks remain server-side enforced via RLS; UI changes alone don't grant access.
