## Problem

Deleting a user fails with "Database error deleting user" because two foreign keys in `public` reference `auth.users(id)` with `ON DELETE NO ACTION`:

- `daily_manpower.created_by → auth.users(id)`
- `worker_attendance.created_by → auth.users(id)`

When the target user has authored any daily-manpower or worker-attendance rows, Postgres blocks `auth.admin.deleteUser()`, which surfaces as the generic "Database error deleting user" from GoTrue. All other user-referencing columns (profiles, user_roles, user_projects, user_custom_roles, submitted_by, approver_user_id, l1/l2_user_id, sheet_approval_history) are either `ON DELETE CASCADE` or have no FK, so they don't block deletion.

## Fix

Migration to switch both FKs to `ON DELETE SET NULL`. The columns are already nullable, so historical rows stay intact and just lose the author reference — the right tradeoff (we keep attendance/manpower history when an account is removed).

```sql
ALTER TABLE public.daily_manpower
  DROP CONSTRAINT daily_manpower_created_by_fkey,
  ADD  CONSTRAINT daily_manpower_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.worker_attendance
  DROP CONSTRAINT worker_attendance_created_by_fkey,
  ADD  CONSTRAINT worker_attendance_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
```

No code changes — `adminDeleteUser` already has the last-admin guard and self-delete guard; once the FKs allow it, deletion will succeed.

## Verification

Retry deleting `peubhelstpp` from User Management — the toast should confirm success and the row should disappear.