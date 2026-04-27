## Problem

When you click a screen in the sidebar, the menu items briefly disappear and then come back. This isn't a navigation bug — it's a permission-loading flicker.

## Root cause

The `usePermissions` hook (`src/hooks/use-permissions.tsx`) re-fetches permissions whenever its `roles` dependency changes. Two things make this happen on navigation:

1. In `use-auth.tsx`, the Supabase auth listener (`onAuthStateChange`) fires on token refresh / tab focus / route changes and calls `setRoles(...)` with a brand-new array reference — even when the role values are identical. React sees a new reference and re-runs the permissions effect.
2. While re-fetching, the hook does not preserve the previous `perms`. The sidebar's `canSee()` returns `false` for everything during that window, so all items vanish. Once the fetch resolves, items render again — producing the hide/show flicker.

## Fix

Make permissions stable so they don't blink during re-fetches.

1. **Stabilize `roles` in `use-auth.tsx`**: when `fetchRoles` returns the same set of roles as before, keep the existing array reference instead of replacing it. This prevents downstream effects from re-running on every auth event.

2. **Don't clear permissions while refetching in `use-permissions.tsx`**:
   - Remove the `setLoading(true)` that visually resets state at the start of each fetch.
   - Keep showing the previously computed `perms` until the new fetch resolves; only then swap them in.
   - Optionally, treat the initial load as the only "loading" state; subsequent refreshes are background updates.

3. **Avoid unnecessary refetches**: gate the effect on a stable, sorted `roles` key (e.g. `roles.slice().sort().join(",")`) plus `user.id`, so identical role sets don't trigger work.

## Files to change

- `src/hooks/use-auth.tsx` — keep `roles` reference stable when content is unchanged.
- `src/hooks/use-permissions.tsx` — preserve previous perms during refetch; depend on a stable roles key.

## Out of scope

No changes to the sidebar UI, routing, RLS, or permission logic itself. Behavior stays identical — only the flicker goes away.