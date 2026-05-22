
# Issue

"Only admins can create users" error appears because `adminCreateUser` server function (`src/utils/admin-users.functions.ts`) hard-checks the system `admin` role and rejects everyone else — including custom-role users granted **Edit** on `user_management`.

# Fix

Update the authorization check in `adminCreateUser.handler` to allow either:
- system `admin` role, OR
- `has_screen_edit(auth.uid(), 'user_management') = true`

Implementation:
- Replace the single `has_role` RPC call with parallel checks: `has_role(admin)` and `has_screen_edit(_, 'user_management')`.
- If neither is true → throw "Forbidden: requires User Management edit permission".
- Keep the rest (login_id uniqueness, auth admin createUser, profile upsert) unchanged.
- Service-role admin client is still used internally (needed to create auth users); the gate above is what enforces who may call it.

# Out of scope

- Granting the system `admin` role to other users stays admin-only (already handled in UI).
- RLS on `profiles` / `user_roles` / `user_projects` already permits user-mgr custom-role users (prior migration).

# Files

- `src/utils/admin-users.functions.ts`
