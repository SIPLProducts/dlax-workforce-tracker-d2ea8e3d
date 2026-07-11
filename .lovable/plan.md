## Plan

Reduce the Daily Entry / OT Entry / Approvals headcount request URL size so nginx/Kong stops returning 502, without dropping any sheets.

### Change

In `src/lib/headcount-totals.ts`, lower the default chunk size from 100 → **25 sheet IDs per request**, and de-duplicate sheet IDs before batching. All sheets are still fetched — just across more small requests, merged into the same totals map. No caller changes needed since `daily-entry.tsx`, `ot-entry.tsx`, and `approvals.tsx` already call this helper.

Why 25: a UUID is 36 chars + `%2C` separator ≈ 39 chars. 25 IDs ≈ 1 KB of query string, well under any reasonable nginx/Kong header buffer, with plenty of margin.

### Not changing

- No DB, RLS, schema, or data changes.
- No limits on how many sheets are loaded — every sheet ID returned by the sheets query is still included; only the batch size per HTTP request is smaller.
- Callers and UI totals unchanged.

### Verify after redeploy

1. Rebuild frontend, `rsync` to `/root/DLAX/`, `pm2 restart all`.
2. Open Daily Entry → saved entries table shows every sheet with its headcount.
3. Network tab: multiple short `daily_manpower?select=sheet_id,headcount&sheet_id=in.(...)` requests, all `200`, no 502.
4. Repeat check on OT Entry and Approvals.
