Move the "No Entry" card below the "Approval Status" card on the dashboard.

## What will change
In `src/routes/index.tsx`, reorder the dashboard sections so the "No Entry Today" alert card appears immediately after the "Approval Status" card, while preserving all existing functionality, styling, and responsive behavior.

Current order:
1. KPI cards
2. Approval Status card
3. Top summaries grid
4. No Entry card
5. Trend chart
6. Detailed Breakdowns tabs

New order:
1. KPI cards
2. Approval Status card
3. No Entry card
4. Top summaries grid
5. Trend chart
6. Detailed Breakdowns tabs

## Implementation notes
- Move the `projectsWithoutToday.length > 0` alert `<Card>` block from its current position (after the Top summaries grid) to directly after the Approval Status `<Card>` block.
- Keep the existing JSX, class names, click handlers, and conditional rendering exactly as they are.
- No state, logic, data fetching, or other components will be modified.
