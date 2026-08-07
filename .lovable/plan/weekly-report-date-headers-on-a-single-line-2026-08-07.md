# Weekly Report: date headers on a single line

## Goal
Each day column header (e.g. "Tue 28.07") shows on one line, on screen and in the PDF, instead of wrapping.

## Screen (`src/routes/reports.tsx`, Weekly tab table header)
- Add `whitespace-nowrap` to the day header cells so the date never breaks.
- Reduce their padding (`px-2` -> `px-1`) and use a slightly smaller font (`text-[10px]`) for the date row and the IR/NMR sub-row, keeping the rest of the table at its current size.
- Keep the table horizontally scrollable so wider ranges still fit.

## PDF (`src/lib/weekly-report-pdf.ts`)
- Change the day header label from two lines (`"EEE\ndd.MM"`) to a single line (`"EEE dd.MM"`).
- Set the day columns to a fixed narrow width and a smaller header font size so the label fits on one line without wrapping; the IR/NMR data cells keep the current font size.

## Unchanged
Data, totals, per-day average, signature section, and all other report tabs.

## Verification
Build the project, then open the Weekly Report and download the PDF to confirm every date reads on one line.
