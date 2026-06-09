## Problem

The Global Search currently opens as a centered modal dialog (`CommandDialog`) that dims the page and floats in the middle of the viewport. The user wants it to behave like a typical search autocomplete (Amazon-style): the results dropdown anchors directly **below the search input** in the top bar, with no backdrop overlay, while the input itself stays in place and acts as the typing field.

## Change

### `src/components/GlobalSearch.tsx` — replace `CommandDialog` with an anchored popover

Convert the trigger button into an actual `Input` (the search field) and render the results panel as a floating dropdown directly beneath it.

- Replace the outer `Button` trigger + `CommandDialog` with:
  - A relatively-positioned wrapper `div` containing:
    - An `Input` (with a left `Search` icon and right `⌘K` kbd hint) — this is the visible field, matching the current width (`md:w-64`+).
    - A conditionally rendered results panel: `absolute top-full left-0 right-0 mt-2 rounded-md border bg-popover text-popover-foreground shadow-lg z-50 max-h-[60vh] overflow-hidden`.
  - The panel uses the existing `Command` primitive (without `CommandInput`, since the outer `Input` drives the query) wrapping the existing `CommandList` + `CommandGroup`s unchanged.
- State: keep `open`, `query`, `results`, `loading`. Open the panel when the input is focused **or** the user has typed ≥1 char; close on:
  - `Escape` keydown on the input,
  - click outside (attach a `mousedown` listener on `document` that checks a `ref` on the wrapper),
  - selecting a result (existing `handleSelect` already calls `setOpen(false)`).
- Keep the existing `⌘K` global shortcut, but make it focus the input (`inputRef.current?.focus()`) and open the panel instead of toggling a dialog.
- Keep all existing search logic, debouncing, result grouping, icons, and `handleSelect` navigation untouched.
- No backdrop / no dimming — the page stays interactive, only the dropdown appears.

### Styling details (match reference)

- Input height `h-9`, rounded, border, muted placeholder "Search anything…".
- Dropdown: white/popover background, soft shadow, ~`max-h-[60vh]`, internal scroll via `CommandList` (already has `max-h-[300px]` — bump via `className` to `max-h-[55vh]`).
- Group headings, separators, and item hover styles remain as-is (already styled via `command.tsx`).
- On mobile (`<md`), the input collapses to icon-only as today; tapping it expands focus and the dropdown anchors below the top bar — no full-screen modal.

### Out of scope

- No changes to `command.tsx`, no changes to `TopBar.tsx` layout, no changes to search logic, results, or navigation targets.
- No new dependencies.

## Verification

- Click the search field in the top bar → dropdown opens directly below it; the rest of the page is **not** dimmed and remains scrollable/interactive.
- Type ≥2 chars → grouped results render in the dropdown; arrow keys + Enter still navigate/select.
- Press `Escape` or click outside → dropdown closes, input retains its value until cleared.
- Press `⌘K` / `Ctrl+K` anywhere → input focuses and dropdown opens.
- Selecting a result → navigates as before and dropdown closes.
