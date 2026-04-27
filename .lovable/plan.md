## Update Login page placeholder + helper text

Make it crystal clear what to type in the User ID field on the login screen.

### Changes (single file: `src/routes/login.tsx`)

**1. Update placeholder**
- From: `e.g. kpc001`
- To: `e.g. bala (not your email)`

**2. Add small helper text below the User ID field**
- Text: *"Enter your User ID only — do not type your full email address."*
- Style: muted, small (matches existing form helper styles).

**3. Auto-strip email if user types one anyway**
- If a user types `bala@sharviinfotech.com`, silently use just `bala` for the lookup.
- Done in the submit handler — no UI flicker.

### Out of scope
- No database changes.
- No changes to the User Management screen.
- Sign-up flow stays disabled (admins create users).

### Files touched
- `src/routes/login.tsx`
