## Problem

On `/masters/approvals`, the **L1 (PC)** and **L2 (PM)** dropdowns appear empty (no options to select). 

**Root cause**: The dropdowns only list users who have the `project_coordinator` (for L1) or `project_manager` (for L2) role assigned in User Management. Currently, no users in the system have either role — only `admin` and `supervisor` roles exist. So both dropdowns render with zero options and look broken.

## Fix

Make the dropdowns always usable, while still encouraging proper role assignment.

### 1. Always show a usable list

Change the L1 and L2 dropdowns so they show:
- **Primary group**: users with the matching role (PC for L1, PM for L2) — labeled "Project Coordinators" / "Project Managers"
- **Secondary group**: all other active users (admins, supervisors, managers) — labeled "Other users" — so an admin can still pick someone temporarily even before the proper role is assigned

Each option shows `display_name (login_id) — role`.

### 2. Empty-state helper inside the dropdown

If literally no users exist in the system, show a disabled item: *"No users found — add users first"* with a link to `/users`.

If users exist but none have the PC/PM role, show an info line at the top of the dropdown: *"No Project Coordinators assigned yet. Assign the role in User Management."* with a link to `/users`.

### 3. Inline hint on the page

Add a small one-line banner above the table when the system has zero PCs or zero PMs:

> Tip: Assign the **Project Coordinator** and **Project Manager** roles to users in [User Management](/users) so they appear in the L1/L2 lists.

Dismissable (stored in `localStorage`).

### 4. Visual fix for the empty `SelectTrigger`

The current trigger renders an em-dash placeholder that looks like a disabled field. Replace with clearer placeholder text: *"Select Project Coordinator"* / *"Select Project Manager"*, and add a subtle "Clear" item (`— None —`) at the top so the user can unassign.

## Scope

- File: `src/routes/masters.approvals.tsx` only
- No DB changes
- No changes to approval logic, RLS, or the manpower flow
- Affects both the **Card view** and **Table view** dropdowns

## Out of scope

- Auto-creating PC/PM roles
- Bulk role assignment from this screen (already possible via Users)
