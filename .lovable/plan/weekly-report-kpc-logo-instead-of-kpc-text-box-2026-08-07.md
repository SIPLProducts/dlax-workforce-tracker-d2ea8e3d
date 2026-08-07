# Weekly Report: KPC logo instead of "KPC" text box

Replace the boxed "KPC" letters in the Weekly Labour Report header with the actual KPC logo image — on screen and in the downloaded PDF. Wording lines ("KPC PROJECTS LTD", "KPC Projects Limited") stay as text, and Excel downloads keep their current text header.

## Changes

1. **Weekly Report header on screen (`src/routes/reports.tsx`)**
   - In the third header cell, swap the bordered "KPC" text for the existing logo component (light-surface variant), sized to fit the same box height so the header layout and borders are unchanged.

2. **Weekly Report PDF (`src/lib/weekly-report-pdf.ts`)**
   - Draw the logo image inside the same right-hand header cell instead of the "KPC" text, centered and scaled to fit within the cell with a small padding, preserving the logo's aspect ratio.
   - The logo is embedded as a base64 data URL so the PDF has no runtime network dependency.

## Technical notes

- The logo already exists in the project as `src/assets/kpc-logo-dark.png` (dark ink version, correct for white PDF/report backgrounds) and is wrapped by `src/components/KpcLogo.tsx`.
- For the PDF, the PNG is inlined via a small module that exports its data URL, then placed with jsPDF's `addImage` at computed x/y/width/height inside the existing header cell rectangle.

## Out of scope

- Excel/matrix exports (`summary-matrix-xlsx.ts`, `dlr-daily-matrix.ts`) keep their text titles.
- No change to report data, columns, totals, filters, or any other tab.
