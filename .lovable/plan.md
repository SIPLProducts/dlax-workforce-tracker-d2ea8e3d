## Goal

Add **Email** and **Mobile No** fields to the user Create and Edit forms on `/users`. Email is required, mobile is optional. No edge functions — everything via the existing TanStack server functions.

## Schema change

Migration on `public.profiles`:

- Add `contact_email text` (the user-facing email)
- Add `mobile_no text`
- Validation triggers (not CHECK, per project rules): basic email regex on `contact_email` when non-null; digits/`+`/`-`/space, length 7–20 on `mobile_no` when non-null
- Optional partial unique index on `lower(contact_email)` where not null, to prevent duplicates

Leave existing `profiles.email` (the synthetic `<login>@dlax.local`) alone — login still goes by User ID, and `contact_email` is the real address.

## Server function changes — `src/utils/admin-users.functions.ts`

`adminCreateUser` input gains:
- `contactEmail: string` (required, trimmed, must match email regex)
- `mobileNo?: string` (optional, normalized: trim, collapse spaces)

After auth user creation, the existing `profiles` upsert writes both new columns alongside `display_name`/`login_id`. Reject on duplicate `contact_email` with a clean message.

`adminUpdateUser` input gains optional `contactEmail` and `mobileNo`. If provided, included in the existing `profiles.update(...)` block. Same validation + duplicate guard.

No edge functions. No changes to `auth.users` email.

## UI changes — `src/routes/users.tsx`

**Create form** — extend the existing grid to include two more inputs:
- Email (required, `type="email"`, placeholder `name@example.com`)
- Mobile No (optional, `type="tel"`, placeholder `+91 98765 43210`)

**Edit dialog** — add the same two fields, prefilled from the row. Saved via `adminUpdateUser`.

**Users table** — add an **Email** column (between User ID and Display Name) and a **Mobile** column. Both show "—" when empty. The existing synthetic `<login>@dlax.local` is no longer displayed; the visible email is `contact_email`.

`UserWithRoles` type, `fetchAll` mapper, and the rendered rows are updated to carry `contact_email` and `mobile_no`.

## Validation summary

- Email: trim, lowercase compare; regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; max 255 chars
- Mobile: trim; regex `/^[+0-9][0-9\s\-]{6,19}$/`; max 20 chars
- Client-side error toasts mirror server-side errors

## Verify

1. Create a new user with email + mobile → row appears with both columns filled.
2. Create without email → blocked client-side and server-side.
3. Create with a duplicate email → server returns clean "Email already in use".
4. Edit existing user, change email and mobile → table updates after save.
5. Clear mobile in edit → saves as empty (allowed).
