# Weekly Report — "Prepared By" signature block

Add a signature area at the bottom of the Weekly Labour Report, both on screen and in the PDF download.

## What it looks like

Below the report table, a bordered footer block with:

```text
Prepared By                                        Signature
______________________            ______________________
Name / Designation                          Date:
```

- Left cell: "Prepared By" label with a blank signature line underneath.
- Right cell: "Signature" label with a blank line and a "Date:" line, so it can be signed after printing.
- Nothing is prefilled — purely blank space for a handwritten signature.

## Changes

- `src/routes/reports.tsx` (Weekly tab): render a bordered two-column block after the table, styled with existing semantic tokens, matching the report's header band look. Shown only when the report has rows.
- `src/lib/weekly-report-pdf.ts`: after the autoTable render, read `doc.lastAutoTable.finalY`, add a signature band (rectangle split into two cells, labels, and blank signature rules) with the same margins/line style as the header band. If there isn't enough room before the page bottom, add a page first so the block never gets clipped.

No data, query, totals, or Excel/other-report logic changes.
