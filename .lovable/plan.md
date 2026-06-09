## Problem

In `src/hooks/use-highlight-row.ts`, after navigating from Global Search, the matched row gets a ring highlight that is removed after 2500ms and the `?highlight=` param is cleared. Users find this too quick to notice.

## Change

Update `src/hooks/use-highlight-row.ts` so the highlight persists instead of auto-clearing:

1. Scroll the matched row (`[data-row-id="<id>"]`) into view as today.
2. Apply a stronger, more visible highlight using existing design tokens:
   - `bg-primary/10`, `outline`, `outline-2`, `outline-primary`, plus `rounded-sm` for a cleaner ring.
3. **Remove the `setTimeout` that strips the classes and clears the URL param.** The highlight stays on the row.
4. Add dismiss triggers so the highlight does not stay forever:
   - First user click anywhere in the document, OR
   - First `keydown` (Esc / any key), OR
   - Route/path change (navigating away).
   On any of these, remove the highlight classes and clear `?highlight=` from the URL via `navigate({ to: ".", search: prev => { delete prev.highlight; return prev }, replace: true })`.
5. Clean up listeners on unmount.

No other files change. No change to `GlobalSearch.tsx`, route configs, or styling tokens. Behavior for screens that don't use the hook is unaffected.

## Verification

- Open Global Search, pick a Project / Contractor / Department / Category / Sheet result.
- Target screen opens, row scrolls into view, ring + tint remain visible indefinitely.
- Clicking anywhere or pressing a key clears the highlight and removes `?highlight=` from the URL.
- Navigating to another screen also clears it.

## Out of scope

- No change to which screens consume the hook, the search itself, or the highlight color tokens beyond adding `rounded-sm`.
