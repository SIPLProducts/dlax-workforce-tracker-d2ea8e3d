# Fix Weekly Report PDF text color

## Goal
Make the Weekly Labour Report PDF download display body text in a clear, dark color instead of the current light gray.

## Current state
- `src/lib/weekly-report-pdf.ts` builds the PDF with `jsPDF` + `jspdf-autotable`.
- `headStyles` and `footStyles` already set `textColor: 0` (black).
- The global `styles` object does **not** set `textColor`, so `jspdf-autotable` defaults to a light gray for body cells, making the data hard to read.

## Change
1. In `src/lib/weekly-report-pdf.ts`, add `textColor: 0` to the `styles` object passed to `autoTable`.
2. Keep all other styling, layout, signatures, and functionality unchanged.

## Verification
- Build the project to confirm no TypeScript or runtime errors.
- Generate a Weekly Labour Report PDF in the preview and visually confirm body text is dark/black.
