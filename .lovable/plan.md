## Goal

Rebuild the **Daily Manpower Entry** screen to look and behave like the uploaded reference sheet:
contractors as rows, worker categories as columns (grouped under CIVIL / MEP / NMR), nature-of-work bands separating contractor groups, plus Security, Deficiency Manpower, Remarks, and a yellow totals row.

## What changes

### 1. Database — small additions

Add to `daily_manpower`:
- `security_count` (integer, default 0) — single value per contractor row
- `deficiency_manpower` (integer, default 0)

Add to `worker_categories`:
- `category_group` (text, nullable) — values: `CIVIL`, `MEP`, `NMR`
- `display_order` (integer, default 0)

No data is deleted. Existing rows continue to work; new columns default to 0/null.

### 2. Daily Entry screen rebuild (`src/routes/daily-entry.tsx`)

Replace the current row-based editor with a **wide grid**:

```
                                                CIVIL — Item rate / Subcontract        MEP — Item rate / Subcontract        NMR Man powers
Sl  Contractor          Contact   Work Place    Rod  Shutt Mason Scaff Paint Helper    Plumb Carp Fit Weld Elec Helper    Mason M/C F/C    Total Sec  Defic  Remarks
─── Shuttering & Rod Benders (band header) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1   J V INFRA           961...    Guest House    8    12    .    .     .     3         .     .   .   .    .    .         .     .   .       23    .    .      ...
2   Sobha / SD          984...    Block C        10   11    .    .     .     2         .     .   .   .    .    .         .     .   .       23    .    17     ...
─── Brick Work & Plastering ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1   AARKA               901...    Block E1...    .    .    48    .     .    49         .     .   .   .    .    .         .     .   .       97    .   153     ...
...
═══ TOTAL (yellow band) ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                                51   52   174    0    22     0        12     0  28   4    8  333         8    42   8      742   12
```

**Behaviour:**
- One **editable row per contractor** for the selected date + project.
- Contact No and Work Place auto-fill (read-only) from the Contractors master.
- Headcount cells are inline number inputs; empty/zero cells show as blank.
- Row Total auto-calculates (sum of all category cells).
- **Footer total row** (yellow band) auto-sums every column across all rows.
- Contractors are grouped into bands by their `nature_of_work` field (e.g. "Shuttering & Rod Benders", "Brick Work & Plastering", "ELECTRICAL WORKS"). Contractors without a nature_of_work go under "Uncategorised".
- Group headers use a soft tinted band (light amber/peach like the screenshot) with bold uppercase label.
- Category columns are grouped under three coloured super-headers: CIVIL (light blue), MEP (light blue), NMR Man powers (light peach), with sub-headers per category.
- Sticky header + sticky first 4 columns (Sl / Contractor / Contact / Work Place) on horizontal scroll.

**Toolbar (kept):** date picker, project picker, Copy Previous Day, Save, Template + Bulk Upload.
- "Add Row" is removed — rows are derived from the contractor master.
- Optional filter: "Show only contractors with entries" toggle (default off, so the full register is visible like the sheet).

**Save logic:**
- For each contractor row that has any non-zero value (in any category, security, or deficiency, or remarks), upsert one `daily_manpower` record per (contractor × category) with headcount > 0 — this preserves the existing per-category schema.
- Security and Deficiency are stored once per contractor — written onto the first inserted row for that contractor for that day, or onto a dedicated marker row using a sentinel category. **Recommended:** store `security_count` and `deficiency_manpower` on every row for that contractor on that date (same value duplicated) so reports stay simple. Will confirm during implementation if a different shape is preferred.

### 3. Master data prep (one-time)

Add a small admin helper in **Categories master** to set `category_group` (CIVIL / MEP / NMR) and `display_order` for each existing worker_category. Until those are set, all categories fall under a single "OTHERS" group so the screen still works.

Same for Contractors: ensure `nature_of_work` is editable in Contractors master (already a column, just expose it cleanly in the form). Without it, contractors fall under "Uncategorised".

## Out of scope

- No changes to Reports, Dashboard, Worker Attendance, or auth.
- No change to RLS policies (existing daily_manpower policies still apply to the new columns).
- No printing/PDF export in this pass — Excel template/upload remain.

## Technical notes

- New file `src/components/DailyEntryGrid.tsx` to keep the wide table out of the main route file.
- Use CSS Grid + sticky `position: sticky; left: 0` on the first 4 columns; sticky `top: 0` on the two header rows.
- Tailwind tints: amber/peach for nature-of-work bands and NMR header, sky/blue for CIVIL & MEP headers, yellow for the totals row — defined in `src/styles.css` as utility classes (`band-amber`, `band-sky`, `band-peach`, `band-yellow`) so the design system stays consistent.
- All numeric inputs use `tabular-nums` and right-aligned text.
- Mobile: horizontal scroll with sticky contractor column; the existing mobile card list is removed since the sheet format is inherently spreadsheet-shaped.
