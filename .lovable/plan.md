## Why "pc" doesn't appear after creation

When you click **Create User**, the UI shows a green success toast, but the user is never actually created. Behind the scenes:

1. The browser sends the create-user request to the server.
2. The server **rejects it with a 401 Unauthorized** because the request is missing the login token.
3. The error response is being silently treated as `{}` by the client, so the UI shows "success" and then refreshes — but there's no new user, because nothing was created.

You can confirm this in the network logs: `POST /_serverFn/... → 401`, and the profiles list returned by the server has no `pc` row.

## Root cause

The protected server function (`adminCreateUser`) requires the caller's Supabase session token in the `Authorization` header. The current client call from `src/routes/users.tsx` does not attach that token, so the auth middleware rejects every request with 401.

The previous "user created successfully" message for some other accounts (`bhelstpp`) likely worked by another path; new attempts (`pc`, `IIPEVSKP`) consistently fail with 401.

## Fix plan

1. **Forward the session token to the server function**
   - In `src/routes/users.tsx` (`handleCreateUser`), read the current Supabase session via `supabase.auth.getSession()` and pass `access_token` in the request `headers: { Authorization: "Bearer <token>" }` when invoking `adminCreateUser`.
   - If no session is found, abort early with a clear error toast ("Please sign in again").

2. **Stop showing fake success on failure**
   - Treat any non-2xx / thrown response from the server function as an error and display the real message.
   - Only show the success toast and call `fetchAll()` after the server confirms a `userId` was returned.

3. **Surface 401 / permission errors clearly**
   - If the server returns 401, show "Session expired — please sign in again".
   - If it returns 403, show "Only admins can create users".

4. **Verify**
   - Re-create user `pc` and confirm:
     - Network: `POST /_serverFn/...` returns `200`
     - Console: `[create user] server response` includes `userId` and `loginId`
     - The `pc` row appears immediately in **All Users**.

## Technical details

Implementation will set per-call headers using TanStack's server-function options:

```ts
const { data: { session } } = await supabase.auth.getSession();
if (!session) { toast.error("Please sign in again"); return; }

const result = await createUserFn({
  data: { loginId, password, displayName },
  headers: { Authorization: `Bearer ${session.access_token}` },
});
```

This restores the Authorization header that `requireSupabaseAuth` middleware in `src/integrations/supabase/auth-middleware.ts` expects, eliminating the 401 and letting the existing profile-upsert logic in `src/utils/admin-users.functions.ts` actually run.

No database/schema changes are required.
