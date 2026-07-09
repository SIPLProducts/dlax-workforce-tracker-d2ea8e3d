## Problem

The OT Entry grid header shows the same white strip between the department row (Civil) and category row (Painting, Structural Steel Work), with weak group separation and cramped category text — matching the previous Daily Entry issue.

## Fix (single file: `src/routes/ot-entry.tsx`, presentation-only)

Mirror the Daily Entry pass:

1. **Two-row department header** (lines ~1016–1036)
   - Fixed row heights: `<tr className="h-9">` for both header rows.
   - Frozen left cells (`Sl.no`, `SC Code`, `Name of the Contractor`, `Contact No`, `Work Place`): keep `rowSpan={2}`, ensure background stays `bg-slate-100`, add matching `border-b border-t`.
   - Department `<th>`s: apply `g.headerClass`, `border-b border-t border-r-2 border-r-slate-300`, `text-[13px] font-semibold uppercase tracking-wide`, `bg-clip-padding`.
   - Category `<th>`s: apply `g.headerClass`, `sticky top-9` (instead of `top-[36px]`), `text-[11px] font-medium min-w-[84px] whitespace-normal leading-tight align-middle`, and `border-r-2 border-r-slate-300` on the last cell of each group; other cells `border-r border-r-slate-200`.
   - Trailing `Total` / `Time (OT Hrs)` / `Remarks` / `Weather`: keep `rowSpan={2}`, add `bg-clip-padding` and matching padding for a shared baseline.

2. **Body group dividers** (lines ~1053–1069)
   - Track `isLastInGroup` per cell in the map; add `border-r-2 border-r-slate-300` on the last cell of each department group, `border-r border-r-slate-200` elsewhere, alongside the existing `g.cellClass` tint.

3. **Footer/totals row** (if present near line ~1082+)
   - Apply the same group-separator border logic so the totals row aligns visually.

## Out of scope

- No data, save/submit, sticky column widths, or OT-hours logic changes.
- No changes to Saved Entries tab or any other route.

## Verification

- Reload `/ot-entry`, pick a project with multiple departments → header shows continuous tinted blocks per department, no white strip, wrapped category names, visible group dividers on header/body/footer, frozen left columns still stick correctly on scroll.
