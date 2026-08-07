# Daily Labour Report: frozen panes + category totals row

Two changes to the on-screen Daily Labour Report table (`src/components/DlrDailyPreview.tsx`). Downloads, filters and totals logic stay as-is.

## 1. Freeze headers and the first two columns

- The table gets a fixed-height scroll container (`max-h-[70vh] overflow-auto`) so the body scrolls vertically and horizontally inside the card.
- All header rows (title, department band, category names) become sticky to the top, each row pinned at its own offset so the full multi-row header stays visible while scrolling down.
- `Sl.No.` and `Name of the Project` become sticky to the left with fixed widths, staying visible while scrolling right.
- The two intersection areas (sticky header cells over sticky columns) get a higher stacking order and solid background so nothing shows through when scrolled in both directions.
- Group/section band rows keep their sticky first column so the group name remains readable.

## 2. Category-wise Total row at the bottom

- A footer row is appended that sums each category column across all project rows, plus the Sub Contractors/Job Work, NMR, Total and Security columns.
- Labelled "Total" in the Project Name cell, styled like the totals band (bold, highlighted background), right-aligned numbers with the same zero-as-dash formatting.
- The footer row is sticky to the bottom of the scroll container so it stays visible while scrolling, and its first two cells stay sticky to the left as well.

## Technical notes

- Totals computed in the component from `matrix.cells`, skipping `matrix.headerRows` and `matrix.sectionRows` — no change to `src/lib/dlr-daily.ts` or the export builders (the Matrix Format export already has its own grand-total row).
- Sticky offsets use Tailwind classes with explicit column widths so `position: sticky` works with `border-collapse`; borders on sticky cells use box-shadow-style separators where collapse would drop them.
