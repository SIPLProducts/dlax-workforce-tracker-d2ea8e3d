## Add "Weather Condition" column to Daily Entry

Insert a new column **Weather Condition** in the Daily Manpower Entry table, positioned **after Remarks** and **before Status**. The field is a predefined dropdown per contractor row.

### Predefined options
- Sunny
- Cloudy
- Rainy
- Heavy Rain
- Stormy
- Foggy
- Hot
- Windy

(Final list can be tweaked — confirm if you want different/more options.)

### Changes

**1. Database (migration)**
- Add column `weather_condition text` (nullable) to `public.daily_manpower`.
- No RLS changes needed (existing policies apply).

**2. UI — `src/routes/daily-entry.tsx`**
- Add new `<th>` "Weather" header between Remarks and Status (both header rows updated for rowSpan layout).
- Add a `<Select>` cell per contractor row bound to `rows[contractor.id].weather`.
- Extend `RowData` type and `emptyRow()` with `weather: string`.
- Extend load logic to read `weather_condition` from each `daily_manpower` record.
- Extend save logic (`inserts`) to include `weather_condition: r.weather || null`.
- Update the totals row `<tfoot>` to add an empty cell for the new column.
- Update the colSpan on the "Loading…" / "No contractors" placeholder rows.

### Out of scope
- Reports/exports won't yet include weather (can be added later if needed).
- Approvals screen unchanged.
