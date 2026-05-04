## Problem

Clicking any sidebar link causes the **entire sidebar to flash / re-render** before the new page appears.

## Root cause

`AuthGuard` is wrapped *inside every route component* individually:

```tsx
// every route file does this
component: () => <AuthGuard><Page /></AuthGuard>
```

`AuthGuard` renders `AppLayout`, which renders `SidebarProvider` + `AppSidebar`. Because each route is a separate component tree, navigating from `/masters/approvals` → `/users` **unmounts and remounts** AuthGuard, AppLayout, SidebarProvider, and AppSidebar every time. During that remount:
- `usePermissions` re-fires its async fetch (`user_custom_roles`, `role_screen_permissions`) → menu items flicker in
- `SidebarProvider` resets its open/collapsed state
- The whole sidebar DOM is torn down and rebuilt

That tear-down is the "flash" the user sees.

## Fix — make the sidebar persistent via a TanStack pathless layout route

TanStack Router supports pathless layout routes (`_authenticated.tsx`) that own a subtree. The sidebar lives in the layout and **stays mounted** while only the `<Outlet />` swaps content.

### 1. Create `src/routes/_authenticated.tsx`

A pathless layout route that:
- Runs the auth gate (`beforeLoad`: redirect to `/login` if no user)
- Renders `AppLayout` (which holds `SidebarProvider` + `AppSidebar`) once
- Renders `<Outlet />` for child routes

### 2. Move every protected route under the `_authenticated` layout

Rename so they become children of the layout route:

| Old | New |
|---|---|
| `src/routes/index.tsx` | `src/routes/_authenticated.index.tsx` |
| `src/routes/daily-entry.tsx` | `src/routes/_authenticated.daily-entry.tsx` |
| `src/routes/approvals.tsx` | `src/routes/_authenticated.approvals.tsx` |
| `src/routes/reports.tsx` | `src/routes/_authenticated.reports.tsx` |
| `src/routes/users.tsx` | `src/routes/_authenticated.users.tsx` |
| `src/routes/masters.*.tsx` | `src/routes/_authenticated.masters.*.tsx` |

`login.tsx` stays at the root (no auth/sidebar).

The URLs do **not** change — pathless segments (prefixed with `_`) are stripped from the URL.

### 3. Remove the per-route `<AuthGuard>` wrapper

Each migrated route changes from:
```tsx
component: () => <AuthGuard><Page /></AuthGuard>
```
to:
```tsx
component: Page
```

`AuthGuard` is no longer needed (the layout handles it). The file itself can stay for now or be deleted later.

### 4. Stabilize `usePermissions` cache (small follow-up)

Even with the persistent layout, switching tabs shouldn't refetch perms. Already keyed on `[userId, rolesKey]`, so it won't refire — good. No DB change needed.

## Result

- Sidebar mounts **once** after login and stays mounted forever
- Navigating between screens only swaps the page content inside `<Outlet />`
- No flash, no permission refetch, sidebar collapse state preserved across navigation

## Scope

- New file: `src/routes/_authenticated.tsx`
- Renames: ~10 route files
- Edit: each renamed route loses the `<AuthGuard>` wrapper
- No DB / RLS / auth-logic changes
- No visual changes to the sidebar itself

## Out of scope

- Redesigning the sidebar
- Removing `AuthGuard.tsx` (kept for safety; can be deleted in a later cleanup)
