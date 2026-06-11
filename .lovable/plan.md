# Fix OT Entry Sheet — disabled-on-direct-open

## Problem

Opening `/ot-entry` from the sidebar shows the full grid in read-only/disabled state with no way to enter data. The screen should only load contractor data and become editable when the user clicked **Yes** on the Daily Entry OT popup.

Root cause in `src/routes/ot-entry.tsx`:
- `mode` defaults to `"view"`, so `readOnly = mode === "view" || !canEdit` → grid renders disabled.
- The Edit button is gated by `canEdit` (sheet status); for a fresh empty sheet that's fine, but no `from=daily` signal currently switches it to edit automatically.
- Data loads unconditionally as soon as the route mounts.

## Changes

### 1. `src/routes/daily-entry.tsx`
On the OT popup "Yes" navigation, pass an extra flag:
```ts
navigate({ to: "/ot-entry", search: { project: projectId || undefined, from: "daily" } });
```

### 2. `src/routes/ot-entry.tsx`
- Extend `validateSearch` to also read `from: "daily" | undefined`.
- Add a `triggered = search.from === "daily"` gate.
- **Direct open (no `from=daily`)**: render an empty landing state — header + a centered Card saying *"OT Entry opens from the Daily Entry Sheet. Save today's Daily Entry and choose 'Yes' on the OT prompt to begin."* with a button **Go to Daily Entry** (`navigate({ to: "/daily-entry" })`). Skip all data fetching (contractors / assignments / sheet load) when `!triggered`.
- **Triggered open (`from=daily`)**: keep current behaviour, but:
  - Set initial `mode` to `"edit"` (instead of view) so fields are immediately editable.
  - Keep the previous-day date locked (unchanged).
  - All approval/save flow (`Send to Approval`, totals, Saved Entries tab) stays identical.

### 3. Sidebar (`src/components/AppSidebar.tsx`)
Leave the "OT Entry Sheet" link in place — clicking it now lands on the empty informational screen, which matches the requested "initially empty" behaviour.

## Technical notes

- No DB / migration changes.
- `from` is a transient UI flag only; not persisted.
- Approval workflow, `sheet_type='ot'` scoping, and the Time (OT Hrs) column are untouched.
- Permission checks (`canEditPerm("ot_entry")`) still apply on top of the new mode default.
