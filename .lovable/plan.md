# Fix: redirected back to /login immediately after successful login

## Root cause

After `signInWithPassword` resolves, the Supabase client stores the session in `localStorage`, but `AuthProvider`'s `user` state is updated asynchronously via the `onAuthStateChange` callback (which itself uses `setTimeout(..., 0)` to fetch roles). The login page calls `navigate({ to: "/" })` immediately on success.

Sequence that produces the loop:
1. Login succeeds, session is in localStorage.
2. `navigate("/")` runs before React has flushed the `setUser(...)` from `onAuthStateChange`.
3. `RootShell` renders for `/` with `user` still `null` and `loading` already `false`.
4. Its `useEffect` fires `navigate({ to: "/login" })`.
5. By the time the auth state finally updates, we're back on `/login`.

This is consistent with: login toast says success, then page snaps to `/login`. It is NOT a self-hosted Supabase / Kong / JWT problem — those would fail the sign-in call itself.

## Fix

Two small, surgical changes — no business logic, only the auth/redirect plumbing.

### 1. `src/hooks/use-auth.tsx`
- In `signIn` and `signInWithUserId`, after a successful `signInWithPassword`, **synchronously seed `session` and `user`** from the returned `data` (don't wait for `onAuthStateChange`).
- Remove the `setTimeout(..., 0)` wrapper around `fetchRoles` in `onAuthStateChange` so role fetch starts immediately (the wrapper is unnecessary here and contributes to the lag).

### 2. `src/components/RootShell.tsx`
- Before redirecting to `/login` in the effect, do one **session re-check**: call `supabase.auth.getSession()`. If a session exists, skip the redirect (the React state simply hadn't caught up yet). This makes the guard race-proof without weakening it.
- Same guard added to `src/components/AuthGuard.tsx` for consistency (it's still used in places).

## Why not just `window.location.assign("/")`

A hard reload would also mask the bug, but it loses SPA state, flashes a white screen, and breaks the existing TanStack Router flow. The two changes above keep the SPA navigation and remove the actual race.

## Files touched

- `src/hooks/use-auth.tsx` — seed user/session on successful sign-in; drop the `setTimeout` around `fetchRoles`.
- `src/components/RootShell.tsx` — re-check `getSession()` before redirecting to `/login`.
- `src/components/AuthGuard.tsx` — same re-check.

No DB, install.sh, Kong, or migration changes are needed for this issue.

## Verification

1. Open `/login`, sign in as `admin / admin123456`.
2. Expect to land on `/` and stay there; sidebar renders; no bounce back to `/login`.
3. Hard refresh on `/` — should stay logged in.
4. Click `Sign out` — should land on `/login` and stay there.
