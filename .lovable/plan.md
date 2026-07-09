## Problem

On the Daily Entry screen, the Departments / Categories header area of the entry grid looks broken:

- A visible white strip appears between the department header row (Civil, Electrical) and the category header row (Painting, Structural Steel Work, Street Lighting), so the two rows feel detached from the frozen left columns.
- Department group tint (blue for Civil, green for Electrical) doesn't carry cleanly across both header rows, and the divider between department groups is weak, making it hard to see where Civil ends and Electrical begins.
- The category sub-header cells are short, unpadded, and center-aligned with tight text, so longer names like "Structural Steel Work" and "Street Lighting" look cramped.
- Body cells under each department don't inherit the group tint, so once you scroll the header context is lost.

Data, columns, sticky behavior, totals, and save logic stay exactly as-is. This is a presentation-only pass on `src/routes/daily-entry.tsx`.

## Changes (single file: `src/routes/daily-entry.tsx`)

1. **Unified two-row department header**
   - Keep the existing two-row `<thead>` structure (dept row + category row) and the current `displayGroups` data.
   - Give both header rows the same group tint via `g.headerClass` so Civil's blue and Electrical's green form one solid block spanning dept name + its categories.
   - Add a stronger right border between department groups (e.g. `border-r-2 border-r-slate-300`) on the last cell of each group in both rows to visually separate Civil vs Electrical.
   - Remove the residual white gap by ensuring both `<tr>`s use the tint background (not `bg-slate-100`) and the sticky `top` offset on the category row matches the actual dept-row height.

2. **Better typography and spacing in headers**
   - Dept row: `py-2 text-[13px] font-semibold tracking-wide uppercase`.
   - Category row: `py-2 min-w-[80px] text-[11px] font-medium` with `whitespace-normal leading-tight` so two-word names like "Structural Steel Work" wrap cleanly instead of clipping.

3. **Body cells keep group context**
   - Apply a very light version of the group tint to body cells via `g.cellClass` (already exists) — bump the tint slightly (e.g. `bg-blue-50/40`, `bg-green-50/40`) so each department's column band is visible while scrolling, without overpowering the input.
   - Keep the stronger right border between groups on body rows too, mirroring the header separator.

4. **Frozen left header alignment**
   - The 5 sticky left columns use `rowSpan={2}`. Ensure their background stays `bg-slate-100` and their bottom border aligns with the category row's bottom border so the seam between frozen area and scrollable header disappears.

5. **Totals / Remarks / Weather headers**
   - Give the trailing `Total` / `Remarks` / `Weather` header cells the same `rowSpan={2}` height + padding as the dept block so all header cells share one visual baseline.

## Out of scope

- No changes to data fetching, `displayGroups` / `displayCells` computation, orphan handling, save/submit flow, or Saved Entries tab.
- No column additions/removals; sticky column widths stay identical.
- No styling changes outside the entry grid header + body cell tint.

## Verification

- Reload `/daily-entry`, pick a project with multiple departments (e.g. Civil + Electrical) → header shows two continuous tinted blocks, categories wrap without clipping, no white strip between the two header rows, group separator visible.
- Horizontal + vertical scroll: frozen left columns still stick, dept + category header rows both stick to top, body column tint stays aligned under its department.
- Editing headcount, remarks, weather and saving still works (unchanged).
