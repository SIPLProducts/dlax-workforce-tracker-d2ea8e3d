## Goal

Make every screen usable on phones (≤640px) and tablets (641–1024px) without changing any data, queries, or business logic. Frontend/presentation only.

## Approach

**1. Shared responsive primitives**
- Add a small `MobileCardList` presentation helper (label/value rows + actions slot) used by list screens, so each screen doesn't reinvent card markup.
- Tighten `PageHeader`: title/actions stack on narrow widths; action buttons become icon-only or full-width row on phones.
- Verify `AppLayout` bottom padding clears the mobile tab bar on every route, and `TopBar` controls (search, theme, user menu) collapse into a compact row on phones.

**2. List screens — card lists on mobile, tables from `md:` up**
Applies to: Users, Masters → Projects / Contractors / Departments / Categories / Approvals, Approvals queue, Project Assignments, and the Dashboard drill-down + department tables.
- Wrap existing `<Table>` in `hidden md:block`.
- Add a `md:hidden` card list rendering the same rows: primary field as card title, remaining columns as label/value pairs, row actions as buttons in the card footer.
- Same data source and handlers — only markup differs.

**3. Data Entry / OT Entry grids — keep the grid, scroll sideways**
- Keep the current spreadsheet with its synced top/bottom scrollbars.
- Freeze the first (contractor) column on mobile so context is never lost.
- Reduce cell padding/font at `sm` and below; ensure inputs stay ≥40px tall for touch.
- Add a subtle "swipe to see more →" hint above the grid on phones.
- Stack the filter/date/project toolbar into a single column on phones, two columns on tablet.

**4. Reports**
- Tab list becomes a horizontally scrollable strip on phones instead of a cramped 4-column grid.
- Filter grids: 1 column phone → 2 tablet → 4 desktop.
- Summary matrix and week-wise tables stay tabular inside a scroll container with the sticky left columns intact; export buttons become a full-width stacked group on phones.

**5. Dialogs & forms**
- All master/user dialogs: `max-h-[90dvh]` with internal scroll, near-full-width on phones, form grids collapse to one column.
- Popovers/comboboxes (ProjectCombobox, GlobalSearch) constrained to viewport width.

**6. Login screen**
- Card, QR panel, and install button stack vertically and stay within the viewport on small screens.

## Verification

Screenshot each route at 390px, 768px, and 1280px via headless browser and check for horizontal page overflow, clipped text, and overlapped controls; fix what shows up.

## Technical notes

- Tailwind v4 utilities only; no new dependencies.
- Follow the project's responsive rule for header rows: `grid-cols-[minmax(0,1fr)_auto]` on mobile → `flex` at `sm:`, `min-w-0` on text containers, `shrink-0` on icons.
- No changes to Supabase queries, RLS, hooks, or export logic.
