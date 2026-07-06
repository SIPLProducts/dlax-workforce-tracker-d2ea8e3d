## Unify data + layout across Excel, Matrix Format, and on-screen UI

Currently the three surfaces render different structures:

**Summary Report**
| Surface | Groups by `project_group` | Remarks column | Grand Total | Header structure |
|---|---|---|---|---|
| Matrix xlsx | yes | yes | yes | 2-row banded |
| Plain Excel | no | no | yes | flat |
| On-screen | no | no | yes | flat |

**Daily Labour Report**
| Surface | Sub-Contractor / NMR split | Security col | 4-row banded header | Group header row |
|---|---|---|---|---|
| Matrix xlsx | yes | yes | yes | yes |
| Plain Excel (`buildDlrDailyWorkbook`) | no (single Total Labour band) | no | 3-row | yes |
| On-screen (`DlrDailyPreview`) | no | no | 2-row | yes |

Goal: **all three surfaces show identical data with the same column layout as Matrix**; only visual polish (borders, fills, page setup) remains unique to Matrix xlsx.

### Files touched

- `src/lib/dlr-daily.ts`
  - Extend `HeaderBands` with `subTotalCol`, `nmrTotalCol`, `totalCol`, `securityCol`, `remarksCol` (add Security).
  - `buildBands`: replace per-dept `Total Labour` leaves with two fixed leaves — `Sub Contractors/Job Work` (SUM of non-NMR dept headcounts) and `NMR` (SUM of NMR dept headcounts). Insert `Security` column (value `0`, no data source) between `Total` and `Remarks`.
  - `getDlrDailyMatrix`: emit 4-row header (title, dept band + `Total Labour` band + Total/Security/Remarks, category leaves + sub/NMR leaves, blank sub-descriptor row). Set `headerRows = 4`. Data row: category headcounts + subTotal + nmrTotal + Total (sub+nmr) + `0` (Security) + Remarks.
  - `buildDlrDailyWorkbook`: update merges (dept bands across cat leaves row 1; `Total Labour` merged over sub+nmr leaves rows 1-2; Sl.No / Project / Total / Security / Remarks merged rows 1-3), column widths, freeze `ySplit=4`, section-row merges span new column count.
  - `buildDlrDailyCsv`: unchanged mechanics (already reads from `matrix.cells` + `bands`).
- `src/components/DlrDailyPreview.tsx`
  - Rewrite header to 4-row banded layout mirroring Matrix (Sl.No, Name, dept bands over categories, `Total Labour` band over `Sub Contractors/Job Work` + `NMR`, Total, Security, Remarks). Body row already comes from `matrix.cells[dataRow]` — no data change needed once `bands` reflect new columns.
- `src/routes/reports.tsx` — `SummaryTab`
  - `exportXlsx` (plain Excel): rebuild to walk `projectRows` grouped by `group`, emit group header rows, per-project row with `[code] Name`, day/avg/month values, blank Remarks column, then Grand Total. Same column set and ordering as `downloadSummaryMatrixXlsx`.
  - On-screen table: after each `group` change, insert a group-header `<tr>` with `project_group` (or `Ungrouped` sentinel) spanning columns B..last with muted fill; append a `Remarks` column (frozen right? no — regular scroll) matching the Matrix. Keep existing sticky S.No / Project Name and Grand Total. Continue rendering `p.code` badge + `p.name`.
- `src/lib/summary-matrix-xlsx.ts` — no changes (already the source of truth).
- `src/lib/dlr-daily-matrix.ts` — no changes; it already reads the extended `bands`.

### Out of scope

- Grouped project ordering in the on-screen Summary table follows the same sort as Matrix (group name asc, projects asc within group).
- Security remains `0` everywhere (no field in the app); documented via inline comment.
- CSV export for DLR keeps current mechanics; only gains the new columns automatically via the widened `bands`.
