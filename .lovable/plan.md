## Fix: Disable future dates in Daily Entry date picker

In `src/routes/daily-entry.tsx`, the Calendar component used in the Date popover allows any date to be selected, including future dates. Daily attendance should never be recorded for a day that hasn't happened yet.

### Change

Add a `disabled` prop to the `<Calendar>` in the Date picker so anything after today is non-selectable (greyed out):

```tsx
<Calendar
  mode="single"
  selected={date}
  onSelect={(d) => d && setDate(d)}
  disabled={(d) => d > new Date(new Date().setHours(23, 59, 59, 999))}
  initialFocus
/>
```

Using end-of-today as the cutoff ensures today itself stays selectable while every future day is disabled.

No backend, schema, or other UI changes.

### File touched
- `src/routes/daily-entry.tsx` — single prop addition on the Calendar in the date popover.