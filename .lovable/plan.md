## Fix: Dashboard "From Date" defaulting to tomorrow

### Root cause
In `src/routes/index.tsx`:

- Line 313/314 sets `rangeDays = 0` whenever the user picks a From/To date, and this `0` is persisted to `localStorage` (line 124).
- On next load, line 104 computes `dateFrom = subDays(new Date(), initial.rangeDays - 1)` → `subDays(today, -1)` → **tomorrow**.

That matches the screenshot: From = 10 Jul, To = 09 Jul.

### Fix
Clamp the initial `rangeDays` to a safe minimum when computing the default `dateFrom`, so a persisted `0` (custom range) no longer produces a future date.

Change line 104 to use an effective range of at least 1 day:
```ts
const effectiveRange = initial.rangeDays > 0 ? initial.rangeDays : 30;
const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), effectiveRange - 1));
```

Also stop persisting `rangeDays: 0` (custom) — only persist when it's one of the preset ranges — so reopening the dashboard restores a valid preset window instead of a broken one:
```ts
localStorage.setItem(FILTER_KEY, JSON.stringify({
  rangeDays: rangeDays > 0 ? rangeDays : 30,
  projectId, contractorId, departmentId,
}));
```

No other logic (data loading, filters, exports) changes.
