# Weekly Report — four-label signature row

Replace the current two-cell "Prepared By / Signature" block with a single row of four signature slots, matching the handwritten reference.

## What it looks like

```text
Prepared By        GJS - Incharge      Accounts - Incharge      Project Incharge
_____________      _____________       _______________          _______________
```

- Four equal cells, each with a label and blank space above a signature rule.
- Nothing prefilled, no "Name / Designation" or "Date:" lines.

## Changes

- `src/lib/weekly-report-pdf.ts`: in the signature band, split the box into 4 equal cells with vertical dividers, print the four labels, and draw a blank signature rule inside each cell. Keep the existing page-break guard and margins.
- `src/routes/reports.tsx` (Weekly tab, lines 1263-1276): swap the 2-column grid for a 4-column grid (stacking on small screens) with the same four labels and blank rules.

No data, totals, query, or other-report changes.
