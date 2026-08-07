# Change "GJS - Incharge" to "QS - Incharge" in Weekly Report

## Goal
Correct the Weekly Labour Report signature label from "GJS - Incharge" to "QS - Incharge" everywhere it appears, without affecting any other functionality or layout.

## Files to update
1. `src/routes/reports.tsx` — Weekly Report on-screen signature row labels array.
2. `src/lib/weekly-report-pdf.ts` — Weekly Report PDF signature band labels array.

## Change detail
In both files, replace the string `"GJS - Incharge"` with `"QS - Incharge"` inside the signature label arrays. No other labels, styling, spacing, or logic will be modified.

## Verification
- Open the Weekly Report tab in the Reports screen and confirm the second signature label reads "QS - Incharge".
- Download the Weekly Report PDF and confirm the same label appears correctly.
