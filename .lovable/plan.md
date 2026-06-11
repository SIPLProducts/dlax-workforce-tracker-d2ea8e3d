# Fix: "Save Role" fails with row-level security error

## Root cause

The Save Role flow writes `custom_roles` + `role_screen_permissions` directly from the browser. RLS on `role_screen_permissions` requires the caller to be a system admin **or** to already have `edit` on `user_management` via a custom role. The logged-in `administrator@dlax.local` user satisfies neither:

- No row in `public.user_roles` (so `has_role('admin')` = false).
- Their custom role "Administrator" has zero `role_screen_permissions` rows (so `has_screen_edit('user_management')` = false).

Result: insert is denied → toast `new row violates row-level security policy for table "role_screen_permissions"`.

## Fix

Two coordinated changes — a permanent server-side path for Save Role plus a one-time backfill so existing "Administrator" users actually have admin rights in the database.

### 1. Move Save Role to a server function (defense-in-depth, removes chicken-and-egg)

New `src/utils/admin-roles.functions.ts`:

- `adminSaveRole({ id?, name, description, permissions: Record<screen_key, 'none'|'view'|'edit'> })`
- Uses `requireSupabaseAuth` middleware, then authorizes the caller with the same rule as `adminCreateUser`: system admin **OR** `get_screen_permission(userId, 'user_management') = 'edit'`.
- Performs the write with `supabaseAdmin` (service role) inside a single logical operation:
  1. Duplicate-name check (case-insensitive, excluding current id).
  2. Insert or update `custom_roles`.
  3. Delete existing `role_screen_permissions` for the role, then insert the new full set from `APP_SCREENS`.
- Returns `{ id }`.

Update `src/components/RolePermissionsDialog.tsx` `handleSave` to call this server fn via `useServerFn` instead of the two direct Supabase calls. Same UX, same validation, same toast messages.

This eliminates the RLS chicken-and-egg: a user who is allowed to manage users can always edit roles, even if their own role row is incomplete.

### 2. Backfill: grant system `admin` to any user whose custom role is named "Administrator"

One SQL migration:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ucr.user_id, 'admin'::app_role
FROM public.user_custom_roles ucr
JOIN public.custom_roles cr ON cr.id = ucr.role_id
WHERE lower(cr.name) = 'administrator'
ON CONFLICT (user_id, role) DO NOTHING;
```

This makes existing seed admins (including `administrator@dlax.local`) actual system admins, so every other RLS policy and the `usePermissions` admin baseline work as intended.

### Not changed

- Existing RLS policies on `role_screen_permissions` stay as-is.
- No change to the dialog UI, `usePermissions`, `ScreenGuard`, or any other route.
- No change to `custom_roles` table or other tables.

## Files

- New: `supabase/migrations/<timestamp>_backfill_admin_role.sql`
- New: `src/utils/admin-roles.functions.ts`
- Edited: `src/components/RolePermissionsDialog.tsx` (swap direct Supabase writes for `adminSaveRole`)

## Verification

1. After migration, `SELECT role FROM user_roles WHERE user_id = <admin id>` returns `admin`.
2. Reopen any role in the dialog, change permissions, click **Save Role** → success toast, no RLS error.
3. Existing UI behavior (create role, edit role, duplicate-name check, permission load) unchanged.
