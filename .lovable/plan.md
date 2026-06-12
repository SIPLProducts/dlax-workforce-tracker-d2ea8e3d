## Problem

The OT Entry Sheet already filters by `sheet_type='ot'` everywhere, but **Daily Entry** does not filter at all. Because `daily_manpower` holds both daily and OT rows in one table, Daily Entry currently:

- Loads OT rows into the daily grid → headcounts and totals are inflated (e.g. shows 16 instead of the daily-only value).
- Lists OT sheets in its "Saved Entries" table and lets them open inside Daily Entry → looks like OT data is "in" Daily Entry, and clicking View doesn't go to the OT screen.
- On Save, its delete-then-insert deletes OT rows for the same (project, date) → silently destroys saved OT data.
- Inserts new rows without setting `sheet_type`, relying on a default.

OT Entry Sheet itself is already correct; the visible symptom (saved 3 in OT, but Daily Entry shows 16) comes entirely from Daily Entry mixing the two.

## Fix — `src/routes/daily-entry.tsx` only

No DB / RLS / schema changes. OT Entry Sheet code is untouched.

1. **`loadEntries` (daily grid)** — add `.eq("sheet_type", "daily")` to the `daily_manpower` and `daily_manpower_sheets` queries, so the grid, totals and the header sheet badge reflect only daily rows.
2. **`loadAllSheets` (Saved Entries table)** — add `.eq("sheet_type", "daily")` to the `daily_manpower_sheets` query so OT sheets no longer appear in the Daily Entry saved list. They will continue to appear in OT Entry Sheet's own saved list.
3. **`handleSave` delete** — add `.eq("sheet_type", "daily")` to the delete query so saving a daily sheet never removes OT rows for the same (project, date).
4. **`handleSave` insert** — set `sheet_type: 'daily'` explicitly on every inserted row (mirrors what OT entry does for `'ot'`).
5. **`loadSheetIntoEditor` safety net** — if a sheet with `sheet_type === 'ot'` is ever passed in (e.g. from a stale cache), redirect to `/ot-entry` with the same `{ project, date }` search params instead of loading it into the daily grid.

## Verification

- Save a Daily Entry with headcount 3, then save an OT Entry with headcount 3 for the same project/date → Daily grid total stays 3, OT grid total stays 3, neither overwrites the other.
- Daily Entry "Saved Entries" list shows only DE-* daily sheets; OT Entry "Saved Entries" list shows only OT-* sheets.
- From Approvals, clicking View on an OT sheet still opens OT Entry Sheet with the saved OT data (already works; unchanged).
- Existing daily-only and OT-only flows behave exactly as before.
