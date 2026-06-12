## Goal

The OT Entry Sheet editor (blank grid for new OT entry) should only appear when the user clicks "Yes" on the OT popup after saving a Daily Entry. From the sidebar, users can still reach the OT screen, but they should land on a Saved Entries view — not the blank editor — and can open any past OT record from there.

## Behavior matrix

| Entry path | What shows |
|---|---|
| Sidebar → OT Entry Sheet | Saved Entries list only (no blank editor, no Send to Approval bar) |
| Daily Entry → OT popup → Yes | Blank OT editor for that project/date, ready for entry |
| Saved Entries → View / Edit | OT editor populated with that saved sheet |
| Approvals → View OT record | OT editor populated with that saved sheet |

## Changes (only `src/routes/ot-entry.tsx`)

1. **Reintroduce a soft gate based on URL intent.**
   - Treat the route as "editor mode" only when one of these is true:
     - `search.from === "daily"` (came from OT popup Yes), or
     - `search.date` is present (deep-link to a specific sheet), or
     - the user has opened a sheet from the Saved Entries tab in this session (`openedSheetRef.current === true`).
   - Otherwise the route is in "browse mode".

2. **Browse mode UI.**
   - Hide the header action buttons (Edit / Save / Send to Approval) and the date/project picker card.
   - Render only the Saved Entries tab content (existing component/section), defaulted as the active tab.
   - Clicking View/Edit on a row flips to editor mode (sets `openedSheetRef.current = true` as today) and loads that sheet — unchanged behavior.

3. **Editor mode UI.**
   - Same as current blank-editor behavior: empty rows unless a specific saved sheet was opened. No auto-load of existing OT records for the default project/date.
   - "New Entry" button continues to reset to a blank editor (stays in editor mode since the user is already inside it).

4. **Daily Entry OT popup.**
   - No change needed if it already navigates with `from=daily` (and/or `date=...`). Plan assumes the existing link is preserved; if it isn't, the same edit will add `from: "daily"` to that navigate call.

## Out of scope

- No DB / RLS / schema changes.
- No changes to Daily Entry save logic or the approval workflow.
- Sidebar link to OT Entry Sheet stays visible (permission-gated as today).
