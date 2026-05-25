## Goal

Make the KPC logo on the login (landing) page render with the exact same pixel size and background color as the logo in the authenticated app's sidebar/navbar header — so the branding is visually identical pre- and post-login.

## Reference (dashboard navbar)

In `src/components/AppSidebar.tsx` (SidebarHeader):
- Background: `bg-brand-gradient` (the themed navy gradient defined in `src/styles.css`)
- Logo: `<KpcLogo variant="on-dark" className="h-7 w-auto" />` (28px tall)
- Container padding: `p-4`

## Changes to `src/routes/login.tsx`

**1. Desktop left panel (currently `bg-gradient-to-br from-[#143866] via-[#194170] to-[#1f4d80]`)**
- Replace the hard-coded gradient with `bg-brand-gradient` so it matches the sidebar exactly and follows the active theme.
- Change the logo from `h-10 w-auto mb-6` → `h-7 w-auto mb-6` to match navbar pixel size.

**2. Mobile header logo lockup**
- Currently sits in a `rounded-xl bg-[#194170] px-4 py-3` chip with `h-7` logo.
- Replace `bg-[#194170]` with `bg-brand-gradient` so the chip background uses the same themed navy gradient as the sidebar header.
- Keep `h-7` (already matches).

**3. No other changes**
- Auth form, QR block, feature cards, copyright, decorative amber blurs all remain as-is.
- No changes to `KpcLogo`, `styles.css`, or any other file.

## Result

The KPC mark on the login screen will be the same height (28px) and sit on the same `bg-brand-gradient` navy as the post-login navbar, so the brand carries through 1:1 between pre-auth and in-app surfaces and follows the selected theme automatically.
