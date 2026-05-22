## Why this is happening

Two separate bugs are combining to produce what you see.

### Bug 1 — "duplicate key" error when creating a role
There are already two custom roles in the database: **"Data Entry"** and **"Management"**. The `custom_roles.name` column has a unique constraint, so trying to create another role with the same name (even with different case/spacing in some cases) throws the raw Postgres error you saw. `RolePermissionsDialog.tsx` does not pre-check for an existing name and does not translate the DB error into a friendly message.

### Bug 2 — Custom role doesn't actually restrict the user; they get the "default system role"
This is by far the more important issue. Three things in the current code combine to make custom roles ineffective:

1. **Auto-grant of the `supervisor` system role.** In `src/routes/users.tsx` (`handleAssignCustomRole`, lines ~199–204), whenever a custom role contains `daily_entry = edit`, the app automatically inserts a `supervisor` row into `user_roles` for that user. The 4 users currently holding the "Data Entry" custom role all also have `supervisor` in `user_roles` because of this.

2. **Permissions are UNION-ed, not replaced.** `src/hooks/use-permissions.tsx` merges the system-role baseline (e.g. supervisor → `dashboard:view, daily_entry:edit, reports:view`) with the custom role using `maxPerm`. Because of step 1, every "Data Entry" user already has the full supervisor baseline regardless of what the custom role allows — so the custom role can only ADD access, never restrict it.

3. **Routes themselves are not permission-gated.** Sidebar/MobileTabBar hide links via `canView`, but the route files (`/daily-entry`, `/approvals`, `/reports`, masters, `/users`) don't check permissions in `beforeLoad`. A user can reach a screen by typing the URL even if it's hidden from the sidebar. Combined with #1 and #2, this is why it looks like the user has the "default system role".

So the net effect today: assigning the "Data Entry" custom role silently promotes the user to `supervisor`, which gives them the full supervisor baseline; the custom role's screen list is effectively ignored as a restriction.

---

## Plan

### 1. Friendly handling of duplicate role name — `src/components/RolePermissionsDialog.tsx`
- Before insert/update, query `custom_roles` for a case-insensitive name match (excluding the current `roleId` in edit mode). If found, show: *"A role named '<name>' already exists."* and stop.
- Also catch Postgres error code `23505` / message containing `custom_roles_name_key` in the existing try/catch and surface the same friendly message instead of the raw SQL error.

### 2. Stop auto-granting `supervisor` when assigning a custom role — `src/routes/users.tsx`
- Remove the block in `handleAssignCustomRole` (lines ~197–204) that inserts `user_roles { role: 'supervisor' }`. Custom roles must stand on their own; mixing them with system roles is what's breaking restriction.
- Backfill: clean up the 4 existing users who were auto-promoted. Their `supervisor` rows in `user_roles` should be removed so the custom role is the only thing driving their access. (A one-off data fix migration — listed in Technical section.)

### 3. Make custom roles take precedence over system role baselines — `src/hooks/use-permissions.tsx`
- Change the merge logic: **if the user has any custom role assigned, ignore the system-role baseline entirely** and compute permissions only from `role_screen_permissions`. System roles (admin, supervisor, manager, PC, PM) still apply for users who have NO custom role assigned (backwards compatibility), and `admin` always wins.
- This makes "custom role = the source of truth" for non-admin users who have one, which matches your intent ("they should only be able to access the screens I authorized").

### 4. Enforce permissions in the routes themselves, not just the sidebar
- Add a small `requireScreen(screenKey)` helper used inside `beforeLoad` (or at the top of each route component) for: `/daily-entry`, `/approvals`, `/reports`, `/masters/*`, `/users`. If `canView` is false → redirect to `/` with a toast "You don't have access to this screen". This closes the URL-typing loophole.

### 5. Fix the RLS gap that #2 was working around
Removing the auto `supervisor` grant means custom-role users won't be able to INSERT/UPDATE `daily_manpower` or `worker_attendance` anymore, because the current RLS policies only allow `admin` or `supervisor` system roles to write. We need to extend those policies so that a user with a custom role granting `daily_entry = edit` is also allowed to write.
- Add a security-definer function `public.has_screen_edit(_user_id uuid, _screen_key text)` returning boolean.
- Update the INSERT/UPDATE policies on `daily_manpower` and `worker_attendance` to also accept `has_screen_edit(auth.uid(), 'daily_entry')`. Same idea for `approvals` (`has_screen_edit(..., 'approvals')`) on the approval UPDATE policy if you want PC/PM behavior to also be driveable from custom roles — confirm before I include it.

### Out of scope (ask before doing)
- Adding edit-permission gating *inside* screens (e.g. hiding the Save button when `canEdit` is false). Today the sidebar only hides links; per-screen edit/view enforcement is a bigger change.
- Changing the system roles list itself.

---

## Technical section (for reference)

**Files edited:**
- `src/components/RolePermissionsDialog.tsx` — pre-check name + friendlier error
- `src/routes/users.tsx` — remove supervisor auto-grant in `handleAssignCustomRole`
- `src/hooks/use-permissions.tsx` — custom role overrides baseline (admin still wins)
- `src/routes/daily-entry.tsx`, `approvals.tsx`, `reports.tsx`, `masters.*.tsx`, `users.tsx` — `requireScreen` guard
- New: `src/lib/require-screen.tsx` (small hook/util)

**Migration:**
```sql
-- 1. helper
create or replace function public.has_screen_edit(_user_id uuid, _screen_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.get_screen_permission(_user_id, _screen_key) = 'edit'::permission_level
$$;

-- 2. daily_manpower INSERT/UPDATE policies replaced to also accept custom-role edit
-- 3. worker_attendance INSERT/UPDATE policies replaced similarly
-- 4. one-off cleanup: delete from user_roles where role='supervisor'
--    and user_id in (select user_id from user_custom_roles); -- confirm before running
```

**Confirm before I implement:**
- Are you OK with removing the auto-`supervisor` promotion for the 4 existing "Data Entry" users (bhelstpp, nlchites, unitvskp, iipevskp)? Without that cleanup they'll keep the supervisor baseline.
- Should the `approvals` screen edit permission also drive PC/PM-style approval rights via custom roles, or keep approvals strictly tied to the `project_approval_config` table?
