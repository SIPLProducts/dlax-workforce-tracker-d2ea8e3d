## Show Weather Condition dropdown column in Daily Entry

The DB column (`daily_manpower.weather_condition`), the `weather` field on `RowData`, and the `WEATHER_OPTIONS` list are already wired up. The table UI is missing the actual column — that's why nothing shows on screen. This plan adds the visible column only.

### Changes — `src/routes/daily-entry.tsx`

**1. Header (`<thead>`)**
Insert a new `<th rowSpan={2}>` titled **"Weather"** between the Remarks header and the Status header so order becomes:
```
... | Remarks | Weather | Status
```

**2. Body row (`<tbody>`)**
Between the Remarks `<td>` and the Status `<td>`, add a new cell with a shadcn `<Select>`:
- Value: `r.weather`
- onChange: `updateField(c.id, "weather", val)`
- Options: from existing `WEATHER_OPTIONS` (Sunny, Cloudy, Rainy, Heavy Rain, Stormy, Foggy, Hot, Windy)
- Trigger styled to match inline cells (`h-9`, borderless, transparent bg, `min-w-[130px]`)

**3. Footer (`<tfoot>`)**
Add one empty `<td className="border"></td>` between the Remarks placeholder cell and the Status placeholder cell to keep column alignment.

**4. Placeholder rows colSpan**
Change `colSpan={4 + ALL_COLS.length + 5}` → `colSpan={4 + ALL_COLS.length + 6}` on the "Loading…" and "No contractors" rows.

### Out of scope
- DB migration (already done)
- Load/save logic (already wired)
- Reports/exports (not requested)
