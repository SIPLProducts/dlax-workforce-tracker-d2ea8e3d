## Problem

In the Global Search dialog, the highlighted/selected result has a bright blue background, but the subtitle (e.g. "iipEVSKP") and the leading icon use fixed muted/colored tokens that don't adapt — making them nearly invisible on the selected row.

Root cause: shadcn's `CommandItem` sets `data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground`, but child elements in `GlobalSearch.tsx` hardcode `text-muted-foreground` (subtitle) and `text-primary` / `text-accent` / `text-chart-*` (icons), which override the inherited contrast color.

## Fix (scoped, presentation-only)

1. `src/components/ui/command.tsx` — add the `group` class to `CommandItem` so children can react to the parent's `data-[selected=true]` state. No other change.

2. `src/components/GlobalSearch.tsx` — for every `CommandItem`'s subtitle and leading icon, append a variant that switches color when the row is selected:
   - Subtitle: keep `text-muted-foreground`, add `group-data-[selected=true]:text-accent-foreground/80`
   - Icon: keep its existing color token, add `group-data-[selected=true]:text-accent-foreground`

This guarantees readable contrast in both light and dark across all 4 themes (navy-trust, emerald-prestige, industrial-amber, ocean-deep), because `--accent-foreground` is always defined to contrast `--accent`.

No changes to search behavior, navigation, data, or any other screen.
