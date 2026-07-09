
## Weekly Labour Report — new Reports tab + PDF export

Add a fourth tab **Weekly** in `/reports` that renders and exports the exact 7-day contractor grid from the attached reference (IR / NMR sub-columns per weekday, Total IR, Total NMR, Total Week Labour, Per Week average, project + date-range header, KPC branding, totals row).

### 1. New tab in `src/routes/reports.tsx`

- Extend the `TabsList` with `<TabsTrigger value="weekly">Weekly</TabsTrigger>` (grid becomes `grid-cols-4`).
- Render `<WeeklyTab projects={projects} />` when `tab === "weekly"`.
- Add a new `WeeklyTab` component with these controls (styled like `DlrTab`):
  - **Project** — `ProjectCombobox` (single project, required).
  - **Week starting** — date picker; the report always spans the picked date + 6 days (matching the Wed→Tue window shown in the reference, but week-start is user-selectable so it works for any week).
  - Buttons: **PDF** (primary), **Excel**.

### 2. Data fetch

On (project, weekStart) change:
```
supabase
  .from("daily_manpower")
  .select("headcount, entry_date, contractor_id, departments(name), contractors(id, company_name, contractor_code)")
  .eq("project_id", projectId)
  .gte("entry_date", weekStart)
  .lte("entry_date", weekStart + 6d)
```

Aggregation (in memory):
- 7 day columns keyed by `entry_date`.
- For each row, classify as **NMR** if `departments.name` matches `/nmr/i` (same rule used in `DlrTab`), else **IR** (Item Rate / Sub-contractor).
- Group by `contractor_id`; per contractor per day, sum headcount into `{ ir, nmr }`.
- Sort contractors by `contractor_code` then `company_name`.
- Compute per-row: `totalIR`, `totalNMR`, `totalWeek = totalIR + totalNMR`, `perWeek = round(totalWeek / 7)`.
- Compute column totals + grand totals row.

### 3. On-screen table

Sticky-header table replicating the reference exactly:

```text
┌─────┬───────┬──────────────┬────┬────┬────┬────┬───┬───┬───┬───┬───┬───┬───┬───┬───────┬───────┬────────┬──────────┐
│S.No │SC Code│Contractor    │Day1     │Day2     │…                                          │Total  │Total  │ Total   │ Per Week │
│     │       │              │IR │NMR │IR │NMR │                                             │  IR   │ NMR   │Week Lab │(Total/7) │
└─────┴───────┴──────────────┴────┴────┴────┴────┴───┴───┴───┴───┴───┴───┴───┴───┴───────┴───────┴────────┴──────────┘
```

- Two header rows with rowspans/colspans identical to the PDF.
- Zebra body rows, right-aligned numeric cells (blank cells show `""`, not `0`, to match the reference).
- Bottom **Totals** row (bold, tinted background).
- Above the table: two-line project + date-range banner ("Name of the Project: {name}" · "KPC PROJECTS LTD" · "KPC" logo mark · "Date: dd.mm.yyyy to dd.mm.yyyy" · centered title "WEEKLY LABOUR REPORT") — laid out like the reference PDF.

Empty state: "Select a project and week to preview the weekly labour report."

### 4. PDF export — pixel-close to the reference

Install `jspdf` and `jspdf-autotable` (`bun add jspdf jspdf-autotable`).

New file `src/lib/weekly-report-pdf.ts`:

- Landscape A4, small margins (10mm).
- Top band (3-column layout using `doc.text` + rectangles):
  - Left cell: `Name of the Project: {name}\nDate: dd.mm.yyyy to dd.mm.yyyy`
  - Middle cell: `KPC PROJECTS LTD` (bold, centered) with `WEEKLY LABOUR REPORT` beneath.
  - Right cell: `KPC` logo text (bold, boxed) — keeps the exact reference framing without needing an image asset.
- Body via `autoTable`:
  - `head`: two rows, using `rowSpan`/`colSpan` to build S.No, SC Code, Contractor, seven `{Wed|Thu|Fri|Sat|Sun|Mon|Tue}` day headers (labels derived from `weekStart`) with IR/NMR leaves, Total IR/NMR, Total Week Labour, Per Week.
  - `body`: one row per contractor; empty numeric cells rendered as `""`.
  - `foot`: totals row (bold).
  - Thin grid lines, Helvetica 8pt, header fill light grey — matches the reference styling.
- Filename: `Weekly-Labour-Report-{projectCode|name}-{weekStart:ddMMyyyy}.pdf`.

### 5. Excel export

New file `src/lib/weekly-report-xlsx.ts` using existing `xlsx-js-style` (already a dep). Same layout as the PDF (title banner rows + merged two-row header + totals). Bordered cells, frozen top rows, landscape page setup. Filename mirrors the PDF.

### 6. Notes

- No schema changes; reuses `daily_manpower`, `contractors.contractor_code`, `departments.name`.
- No changes to Daily / DLR / Summary tabs.
- All formatting stays in presentation code (`WeeklyTab`, `weekly-report-pdf.ts`, `weekly-report-xlsx.ts`).
- Screens permission gating already handled by `ScreenGuard` on the route.

### Files touched

- `src/routes/reports.tsx` — new `WeeklyTab`, extra `TabsTrigger`.
- `src/lib/weekly-report-pdf.ts` — new.
- `src/lib/weekly-report-xlsx.ts` — new.
- `package.json` / lockfile — adds `jspdf`, `jspdf-autotable`.
