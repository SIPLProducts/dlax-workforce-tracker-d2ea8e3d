## Goal

Make the date field on **Daily Manpower Entry** easier to use. Currently it's a button that only opens a calendar popover — you can't type a date directly. Replace it with a hybrid input where you can either type the date or pick it from a calendar.

## Changes (`src/routes/daily-entry.tsx` only)

1. **Replace the date Popover/Button** with a compact input group:
   - A text `<Input>` showing the date in `dd/MM/yyyy` format, fully typeable.
   - A small calendar icon button on the right that opens the existing `<Calendar>` popover.
   - Both stay in sync: typing updates the `date` state; picking from the calendar updates the input text.

2. **Typing behaviour**:
   - Accept `dd/MM/yyyy` (and gracefully also `dd-MM-yyyy`, `yyyy-MM-dd`) using `date-fns` `parse`.
   - Validate on blur — if invalid, revert to the last valid date and show a subtle red border briefly.
   - Auto-insert `/` separators as the user types digits (optional polish).

3. **Keep everything else the same**:
   - Same state variable (`date`), same `loadEntries` trigger, same toolbar layout, same styling tokens.
   - No business logic, no DB, no other UI changes.

## Technical notes

- Use existing imports: `format`, `parse` (already imported as `parseDate`), `isValid` from `date-fns`.
- Width: keep the current `w-full sm:w-[180px]` footprint; input takes most of it, icon button is `w-9`.
- Maintain `pointer-events-auto` on the Calendar inside the popover.

## Out of scope

- No changes to save logic, project selector, table, or footer.
- No new dependencies.
