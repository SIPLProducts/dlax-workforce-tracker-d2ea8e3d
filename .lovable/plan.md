## What is happening

The User ID in the screenshot is **`pmbhelstpp`** — not the two IDs removed earlier (`pmubhelstpp`, `pmuiipevskp`).

I checked the backend and found `pmbhelstpp` still exists as a real active account:

- Login ID: `pmbhelstpp`
- Email: `pmbhelstpp@dlax.local`
- User ID: `31c5d284-683a-4415-91df-6f68e62746c9`

So the app is correctly blocking creation because that User ID is already present.

## Plan

1. Remove the active `pmbhelstpp` account from authentication.
2. Remove related rows for that user from:
   - `profiles`
   - `user_roles`
   - `user_projects`
   - `user_custom_roles`
3. Verify the User ID `pmbhelstpp` no longer exists, so it can be recreated from the User Management screen.

## Technical details

This will be a one-time backend data cleanup for user ID `31c5d284-683a-4415-91df-6f68e62746c9`. The earlier cascade fix should prevent future leftover profile rows when auth users are deleted.