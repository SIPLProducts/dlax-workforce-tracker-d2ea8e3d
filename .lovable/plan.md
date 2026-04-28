## Plan

Make the Users screen always show **all projects** in the "Assign Projects" dialog, while keeping Daily Entry and Reports restricted to each user's assigned projects.

## Current behavior
- Project list everywhere is filtered by `has_project_access` (assigned projects only; unassigned admins see all).
- This also restricts the admin-side **Assign Projects** dialog — bad, because admins must be able to pick from the full project catalog to assign any 4 projects to a user.

## Changes

1. Add a SECURITY DEFINER function `public.list_assignable_projects()` returning all projects, callable only by admins.
2. Update `src/routes/users.tsx` to load the dialog's project list via this function (RPC) instead of a direct `projects` table select. Daily Entry, Reports, and other screens stay unchanged and remain restricted by RLS.

## Result
- Admins → see ALL projects in the Users assign dialog regardless of their own assignments.
- prasad.kvvk (admin, 4 assigned) → still sees only 4 in Daily Entry / Reports / project pickers.
- Unassigned admins → continue seeing all projects everywhere.
- Supervisors / managers → unchanged (assigned only).