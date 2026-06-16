## Summary Report — match May'26 reference sheet exactly

### 1. Schema change

Add `contract_type` to `contractors`:

- enum `contract_type`: `'item_rate' | 'nmr'`
- `contractors.contract_type contract_type NOT NULL DEFAULT 'item_rate'`
- Expose the field in the Contractors master (Add/Edit dialog) as a required select. Default existing rows to `item_rate`; admins can flip individual contractors to `nmr`.

### 2. Layout — replicate the reference sheet 1:1

```text
Row 1 (merged A..last):  KPC Projects Limited
Row 2 (merged A..last):  Manpower engaged from <From> to <To>
Row 3 (header):          S.No | Project Name | Manpower deployed at site (merged across day+avg+month cols) | Total labour for the month | Remarks
Row 4 (header):          (empty) | (empty) | (empty) | d1 d2 .. d7 | Avg Week-W | d8..d14 | Avg Week-W | ... | Total | (Remarks)
Body — 3 rows per project (S.No + Project Name merged vertically):
  Item Rate  | <daily Item-Rate headcounts> | <weekly avg> | ... | <monthly total>
  NMR        | <daily NMR headcounts>       | <weekly avg> | ... | <monthly total>
  Total      | <Item Rate + NMR per day>    | <weekly avg> | ... | <monthly total>
Grand Total row (Item Rate / NMR / Total — same 3-row block, summed across projects)
```

Columns are built from the From/To range. Weeks group by ISO week; an `Average per Week-NN` column is inserted after each week's last day. Final column is the monthly total. Day cells display `M/D` (or `D/M` matching the reference); `Average per Week-XX` uses the ISO week number.

Empty weekly-average cells render as `-` (dash). Empty day cells render as `0` (matching the reference where untouched cells show 0). Project rows with zero monthly total are hidden.

### 3. Data flow

Single query on `daily_manpower` (status `approved`) joined to `projects(name, code)` and `contractors(contract_type)`, filtered by `entry_date` range and optional `project_id`. In `useMemo`:

- `byProject -> { itemRate: Map<date, sum>, nmr: Map<date, sum> }`
- `Total = itemRate + nmr` per day
- Weekly avg = sum of that band's days ÷ days-in-band, rounded to 1 decimal
- Monthly total = sum of all day cells in the band

KPI cards (top): Total Labour Count, Avg Labour/Week, Total Labour for the Month — all derived from the same matrix (using the `Total` band).

### 4. Excel export

`xlsx` writes the same A..N grid with merged header rows, merged S.No / Project Name cells per 3-row block, bold Grand Total block, and column widths roughly matching the reference (S.No narrow, Project Name wide, day cells narrow). One sheet named `Summary`.

### 5. Files touched

- `supabase/migrations/<new>.sql` — enum + column + default backfill.
- `src/routes/masters.contractors.tsx` — add `contract_type` select to the dialog and table.
- `src/routes/reports.tsx` — rewrite `SummaryTab` to render the 3-row-per-project layout, fix empty weekly-avg display (`-` for empty bands), and update `exportXlsx` to match.

### Out of scope

Department / category / contractor sub-rows, separate Remarks per row, per-day weather column, MD(KAK) / VP-PROJECTS leadership rows from the reference, sheet-per-day tabs.
