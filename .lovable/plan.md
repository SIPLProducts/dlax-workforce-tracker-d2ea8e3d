## Problem

On the Approvals screen, clicking **View** correctly navigates to `/daily-entry?project=<id>&date=<date>`. The Daily Entry page picks up the `project` search param and calls `setProjectId(search.project)`. However, a second effect that loads the project list also runs on mount and contains:

```ts
if (data && data.length && !projectId) setProjectId(data[0].id);
```

That async closure captured the initial empty `projectId`. When its `await` resolves (typically after the deep-link effect has already set the correct project), the stale check still sees `!projectId === true` and overwrites the selection with `data[0].id` — the first project in the list. Result: Daily Entry always opens the first assigned project instead of the one chosen in Approvals.

## Fix

In `src/routes/daily-entry.tsx`, make the default-project fallback respect the deep-link search param so it cannot overwrite an explicitly requested project.

Change the project-list loading effect (around lines 171–177) so it:
- Only auto-selects `data[0].id` when there is no `search.project` in the URL.
- Uses the functional form of `setProjectId` to avoid the stale-closure race (only set when the current value is still empty).

```ts
useEffect(() => {
  (async () => {
    const { data } = await supabase.from("projects").select("id,name,code").order("name");
    setProjects(data || []);
    if (data && data.length && !search.project) {
      setProjectId((prev) => prev || data[0].id);
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

No other logic changes; the deep-link effect at lines 180–191 already handles setting the project + date and switching to View mode.

## Validation

- From Approvals, click **View** on a sheet whose project is NOT first alphabetically → Daily Entry opens with that project preselected and the correct date in View mode.
- Open `/daily-entry` directly (no params) → first project still auto-selects as before.
- Switch projects manually inside Daily Entry → behavior unchanged.
