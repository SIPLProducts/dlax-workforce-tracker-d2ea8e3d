## Goal

On `/daily-entry`, keep the highlighted top portion pinned while scrolling:
1. `PageHeader` (Daily Manpower Entry title + actions) — already sticky at `top-14`.
2. Date / Project / Status `Card` — currently scrolls away.
3. `TabsList` (Entry Sheet / Saved Entries) — currently scrolls away.

Only the table content below should scroll.

## Changes — `src/routes/daily-entry.tsx` only

### 1. Make the Date/Project Card sticky beneath the PageHeader
Wrap or update the `<Card>` (line 747) so it sticks just under `PageHeader`:

- Add `sticky top-[112px] md:top-[120px] z-20 bg-background` on the `<Card>`.
- Use a slight negative `-mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8` + matching `px-*` is NOT needed — the card already lives inside the padded container and only needs a solid background and z-index so rows pass behind it.
- Offsets: `PageHeader` is `sticky top-14` (56px) and roughly 56–64px tall, so 112–120px puts the card flush below it.

### 2. Make the TabsList sticky beneath the Card
Wrap the existing `<TabsList>` (line 782) in a sticky shell so it stays pinned below the card:

```tsx
<div className="sticky top-[208px] md:top-[224px] z-10 bg-background py-2 -mt-2">
  <TabsList> … </TabsList>
</div>
```

Offset = PageHeader (~64px) + Card (~96px including p-4 + flex-wrap) + spacing. Card height varies because content can wrap; if it visually overlaps, bump the constant. Single tweakable number.

### 3. Reduce the table scroll-container max-height to match
The table currently uses `maxHeight: calc(100vh - 320px)`. With the extra sticky chrome above, raise the subtracted constant so the scrollable region still fits:
- Change to `calc(100vh - 360px)` for both the Entry Sheet table (line 793) and the Saved Entries table wrapper.

### 4. Keep existing inner sticky `<thead>` as-is
The `<thead>` already uses `sticky top-0` inside its own scroll container — no change needed. Pinned columns keep their `left-*` classes.

## Out of scope

- No changes to master pages, business logic, queries, RLS, or data shape.
- No layout changes outside `daily-entry.tsx`.

## Trade-off

The sticky offsets (`top-[112px]`, `top-[208px]`, `calc(100vh - 360px)`) are fixed estimates of stacked chrome height. If the PageHeader actions wrap to a second line on narrow widths, the Card may visually overlap by a few px; the constants can be nudged. A `ResizeObserver`-based measurement is possible but adds complexity for marginal gain.
