## Cause

The URL for that request is ~14 KB long because the code sends up to 500 sheet UUIDs in a single `?sheet_id=in.(...)` query string. Your self-hosted nginx (and Kong upstream) reject requests whose header/URI exceed the default buffer (~8 KB), so nginx returns **502 Bad Gateway** before PostgREST is ever hit. The Lovable cloud preview doesn't hit this because its gateway has bigger buffers.

Two independent fixes — I recommend doing both:

### Fix 1 (code) — batch the `.in()` calls into chunks of 100

Three call-sites all use the same pattern:

- `src/routes/daily-entry.tsx` (line 544–550) — the one throwing 502 now
- `src/routes/ot-entry.tsx` (line 632–638) — same bug on OT screen
- `src/routes/approvals.tsx` (line 78–81) — same bug on Approvals screen

Change each to fetch headcounts in chunks (e.g. 100 IDs per request) and merge results. Each request URL then stays under ~1.5 KB.

Add a small helper:
```ts
async function fetchHeadcountTotals(ids: string[]) {
  const totals: Record<string, number> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await supabase
      .from("daily_manpower")
      .select("sheet_id, headcount")
      .in("sheet_id", chunk);
    (data || []).forEach((r: any) => {
      totals[r.sheet_id] = (totals[r.sheet_id] || 0) + (r.headcount || 0);
    });
  }
  return totals;
}
```
and replace the three inline queries with a call to it.

No RLS, DB, or schema changes are needed. Just rebuild the frontend and rsync as usual.

### Fix 2 (server, optional but recommended) — raise nginx/Kong header limits

So future long URLs also survive. On the server, in the nginx site config for `dlax.kpc.co`:

```
large_client_header_buffers 8 32k;
client_header_buffer_size   32k;
proxy_buffer_size           32k;
proxy_buffers               8 32k;
```
Then `nginx -t && systemctl reload nginx`. For Kong, set `KONG_NGINX_HTTP_LARGE_CLIENT_HEADER_BUFFERS=8 32k` in the stack `.env` and `docker compose up -d --force-recreate kong`.

### Verification

After rebuild:
1. Open Daily Entry → saved entries table loads with headcounts.
2. Network tab: the `daily_manpower?select=sheet_id,headcount&sheet_id=in.(...)` request is now several small 200 responses instead of one 502.
3. Same check on OT Entry and Approvals screens.

Ready to implement Fix 1 (the code change) — confirm and I'll switch to build mode.
