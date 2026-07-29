Add a "Today" preset button on the Dashboard that filters all metrics to only today's date.

## Changes (src/routes/index.tsx)

1. Add a `setToday()` handler that sets `dateFrom` and `dateTo` both to `new Date()` and marks `rangeDays = 1` (sentinel to highlight the button as active).
2. In the PageHeader actions row, add a "Today" button before the 7d/14d/30d/90d group, styled as the active variant when `rangeDays === 1` and both dates equal today.
3. Since existing `setRange(days)` uses `subDays(new Date(), days-1)`, calling it with `1` would already yield today→today. Reuse `setRange(1)` and add label "Today" as a distinct pill in the same segmented control (order: Today | 7d | 14d | 30d | 90d).
4. The subtitle already reads "Workforce overview — {from} to {to}" so it updates automatically. Live data refresh already happens on filter change via existing effect on `[dateFrom, dateTo, ...]`.

No backend or business logic changes.