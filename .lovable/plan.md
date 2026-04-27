# Fix: Custom roles don't unlock screens in the sidebar

## What's happening

You created a custom role **"Data Entry"** and assigned **Dashboard, Daily Entry, Reports** to it, then assigned that role to **BHELSTPP**. The data in the database is exactly right:

| Screen | Permission |
|---|---|
| Dashboard | edit |
| Daily Entry | edit |
| Reports | edit |
| (everything else) | none |

But when BHELSTPP logs in, **Daily Entry doesn't appear in the sidebar** and the screens don't behave as expected.

## Root cause

The sidebar menu only looks at **system roles** (admin / supervisor / manager). It has no idea custom roles or screen permissions exist. Since BHELSTPP has no system role, the sidebar hides "Daily Entry" (which it thinks requires admin or supervisor) and the user sees a stripped-down app.

The same issue applies to write actions inside Daily Entry — the form's "Save" buttons only show for users with the `supervisor` or `admin` system role.

## Fix

Make the app honor custom-role screen permissions everywhere it currently honors system roles.

### 1. Central permission hook
A new `usePermissions()` hook loads each user's effective permission per screen, by combining:
- System role (admin = edit on everything; supervisor = edit on dashboard/daily entry/reports; manager = view on dashboard/reports).
- All custom roles assigned to the user (highest permission wins).

Returns helpers like `canView("daily_entry")` and `canEdit("daily_entry")`.

### 2. Sidebar shows screens by permission, not by system role
**Daily Entry, Reports, Dashboard, Master Data, User Management** all become visible based on `canView(screen)` instead of a hardcoded role list. So BHELSTPP — with the "Data Entry" custom role — will immediately see the three screens you granted.

### 3. Daily Entry "Save" works for users with edit permission
Today the save buttons require the `supervisor` system role. They will instead require `canEdit("daily_entry")`, so the Data Entry custom role can save headcounts and worker attendance. RLS already permits this because we'll also grant `supervisor` to such users behind the scenes — actually, simpler approach:

→ **Use the existing `supervisor` system role as the "can write" flag.** When an admin assigns a custom role that grants `edit` on `daily_entry`, the app additionally adds the `supervisor` system role to that user automatically. This keeps the existing RLS policies working without changes. (You won't see this in the UI; it just happens behind the scenes when you tick "Daily Entry: edit" on a custom role assignment.)

Result: BHELSTPP can save daily entry & worker attendance for their assigned projects.

### 4. Route guards
`AuthGuard` stays as-is (auth only). Screen-level access continues to be enforced by:
- The sidebar (visibility)
- RLS on the database (writes)
- A small in-page check that shows "You don't have permission" if a non-permitted user types the URL directly.

### 5. Reminder banner
After this change, BHELSTPP also needs **at least one project assigned** under User Management → Projects, otherwise the project dropdowns on Daily Entry and Reports will still be empty (this is by design — non-admins are scoped to assigned projects only).

## Files touched
- `src/hooks/use-permissions.tsx` *(new — central permission resolver)*
- `src/components/AppSidebar.tsx` *(visibility based on canView)*
- `src/components/MobileTabBar.tsx` *(same)*
- `src/routes/daily-entry.tsx` *(replace `hasRole("supervisor")` checks with `canEdit("daily_entry")`)*
- `src/routes/reports.tsx` *(same pattern, view permission)*
- `src/routes/users.tsx` *(when assigning a custom role that includes daily-entry edit, also grant supervisor system role)*

## After this is done
- Log out and back in as **BHELSTPP** → Dashboard, Daily Entry, Reports appear in the sidebar.
- Make sure BHELSTPP also has at least one project assigned (User Management → Projects).
- They'll be able to enter daily attendance for that project.
