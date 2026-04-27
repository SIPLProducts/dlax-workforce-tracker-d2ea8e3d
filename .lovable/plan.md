## Replace "Add User" modal with an inline form

Currently clicking **Add User** opens a popup dialog. You want the form to appear inline on the page instead.

### Changes (single file: `src/routes/users.tsx`)

**1. Remove the Dialog wrapper around the create form**
- The modal `<Dialog>` / `<DialogContent>` will be removed.
- The "Add User" button stays in the header but becomes a toggle: clicking it expands an inline form panel directly above the Users table.

**2. Inline form panel (collapsible)**
- Appears as a new `<Card>` between the header and the Tabs.
- Same fields as today: **User ID**, **Display Name**, **Password**.
- Layout: 3 fields in a responsive grid (1 column on mobile, 3 columns on desktop) with the **Create User** button on its own row.
- Has a **Cancel** button to collapse the panel without creating.
- After successful creation: form resets, panel stays open with empty fields ready for the next user (efficient bulk entry) — and a success toast shows. *Or* I can auto-collapse after success — let me know your preference; default will be "stay open" for fast bulk add.

**3. Toggle behavior**
- "Add User" button text becomes "Add User" when collapsed and "Close" (with X icon) when expanded.
- Clicking again toggles the panel.

### Out of scope
- No changes to fields, validation, or backend logic.
- No changes to the rest of the page (tabs, role management, custom roles).

### Files touched
- `src/routes/users.tsx`
