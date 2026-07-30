## What's happening

The Reset button in `src/routes/index.tsx` already bumps a `refreshKey` that re-runs `loadData()`, so the network calls do fire. But when the filters are already at defaults, the returned numbers are identical and there is zero UI feedback — no spinner, no timestamp, no toast. So Reset looks dead even though it worked.

## Fix (Dashboard UI only)

1. **Loading state** — add an `isLoading` flag set at the start of `loadData()` and cleared when the latest sequence finishes. Ignore it for superseded loads.
2. **Visible feedback while fetching**
   - Refresh button: spin the `RefreshCw` icon and disable both Refresh and Reset while loading.
   - KPI/summary cards: subtle dimmed/pulse state during the fetch so the user sees the values re-render.
3. **"Last updated" timestamp** — show `Updated HH:mm:ss` next to the Refresh button, set on every successful load. This proves a reload happened even when the numbers are unchanged.
4. **Reset confirmation toast** — on Reset, show a short sonner toast ("Filters reset — data reloaded") after the load completes.
5. No changes to queries, filter semantics, persistence, or any other page.

## Verification

- With filters already at defaults, click Reset: buttons disable, icon spins, timestamp advances, toast appears.
- Pick Today, click Refresh: Today pill stays active, subtitle keeps today's date, timestamp advances.
