## Problem

When the user clicks "Yes" on the Daily Entry → OT popup, `/ot-entry` always opens as a blank editor — even if an OT Entry Sheet already exists for that project + date. It lets the user create a duplicate.

## Root cause

`src/routes/daily-entry.tsx` line 1091 navigates with only `{ project, from: "daily" }` — no `date`. In `src/routes/ot-entry.tsx` the deep-link effect (line 217–239) only marks `openedSheetRef = true` when `search.date` is present, so without a date it skips the existing-sheet lookup and renders an empty editor.

## Fix (two small edits, no other behavior changes)

### 1. `src/routes/daily-entry.tsx` (OT popup "Yes" handler, line 1091)

Pass the current Daily Entry `date` to OT entry:

```ts
navigate({
  to: "/ot-entry",
  search: {
    project: projectId || undefined,
    date: format(date, "yyyy-MM-dd"),
    from: "daily",
  },
});
```

This aligns with the "View OT from saved list" path (line 766) which already passes `date`.

### 2. `src/routes/ot-entry.tsx` — only flip to view mode when a sheet actually exists

In the deep-link effect (around line 227–234), when arriving via `from=daily` with a date, do a lightweight existence check for `daily_manpower_sheets` (project_id, entry_date, sheet_type='ot'):

- **Sheet exists** → keep current behavior: `openedSheetRef.current = true`, `pendingModeRef.current = "view"`, `setEditorMode(true)`. The existing sheet loads in disabled/view mode (Edit button still respects approval status / permissions — unchanged).
- **No sheet exists** → `openedSheetRef.current = false`, `pendingModeRef.current = "edit"`, `setEditorMode(true)`. Blank editor for that project+date so the user can create the first OT sheet.

The "View from Approvals" path (also uses `search.date`, but without `from=daily`) keeps today's behavior: always opens the specific sheet in view mode.

## Out of scope

- No DB / RLS / schema changes.
- No change to Save, Send to Approval, Saved Entries list, approval workflow, or the disabled Date field & removed "New Entry" button done previously.
- Sidebar OT Entry browse mode unchanged.
