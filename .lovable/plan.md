## Delete two users

Permanently remove the user accounts `pmubhelstpp` and `pmuiipevskp` from the system.

### What gets deleted
Run a migration that deletes both rows from `auth.users` by id:
- `6289196d-02b3-4214-a103-e4c2ce273d08` (pmubhelstpp)
- `e2550e56-40f4-4ca3-aa2c-866f17b3a7b7` (pmuiipevskp)

Because related tables (`profiles`, `user_roles`, `user_projects`, `user_custom_roles`, etc.) reference `auth.users(id)` with `ON DELETE CASCADE`, their profile rows, role assignments, project access, and custom-role assignments will be removed automatically.

Historical data they authored (e.g. `daily_manpower` entries they submitted, approval history) will be retained, since those tables don't cascade-delete on the user — only their ability to log in and their permission rows go away.

### Notes
- This action is irreversible.
- No application code changes; this is a one-time data migration.