# Weekly Report: add "Nature of Work" column

Add a "Nature of Work" column right after "Name of the Contractor" in the Weekly Labour Report — both the on-screen table and the downloaded PDF — with no other layout or logic changes.

## Where the value comes from

Contractors already store a Nature of Work value (set in Master Data > Contractors). The Weekly Report currently fetches only company name and code for each contractor, so the query needs to also read `nature_of_work`. Blank values show as empty.

## Changes

1. **Weekly data model (`src/lib/weekly-report.ts`)**
   - Add an optional `nature` field to each contractor row and populate it from the fetched contractor record.

2. **Weekly data fetch (`src/routes/reports.tsx`, Weekly tab)**
   - Include `nature_of_work` in the contractor selection so it's available for each row.
   - Add the new header cell after "Name of the Contractor" and the matching body cell; update the empty-state and totals row column spans so the table stays aligned.

3. **PDF export (`src/lib/weekly-report-pdf.ts`)**
   - Add the same column after the contractor name in the table head and body, extend the totals footer span, and re-balance column widths slightly so the day columns still fit on landscape A4.

## Out of scope

- No change to grouping, IR/NMR logic, totals, averages, filters, or any other report tab.
