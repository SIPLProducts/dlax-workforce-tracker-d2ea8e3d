## Goal

Redesign the Daily Manpower Entry page to look modern, organized, and easier to scan — without changing any business logic, data, or save behavior.

## What changes (visual only)

1. **Page header**
   - Hero strip with a small icon badge (ClipboardList) next to the title
   - Title, subtitle, and action buttons (Template, Bulk Upload) grouped on the right with cleaner spacing
   - Becomes sticky-friendly with subtle border-bottom separation

2. **Filters card (Date + Project + actions)**
   - Move Date, Project, "Copy Previous Day", and "Add Row" into a single rounded card with light gradient background
   - Better labels, full-width controls on mobile, inline on desktop
   - Primary "Add Row" button uses primary color; "Copy Previous Day" stays outline

3. **Selected project info bar**
   - Replace the plain text strip with three colored info chips (Code / Project / Group) using the existing `stat-tint-*` utilities for visual hierarchy
   - Add a small live counter chip: total headcount and row count

4. **Entries table (desktop)**
   - Wrap in a clean card with subtle header background
   - Zebra striping for rows, hover highlight, slightly larger row padding
   - Right-align Count column with tabular-nums and a subtle badge style
   - Trash icon turns red on hover only

5. **Entries cards (mobile)**
   - Each row becomes a rounded sub-card with a colored left border (alternating tints)
   - Larger touch targets and clearer field grouping

6. **Empty / no-project states**
   - Replace plain text empty state with a friendly illustration block: muted icon, headline, helper text, and a primary "Add Row" CTA inside

7. **Save bar**
   - Desktop: sticky footer save bar with total headcount summary on the left and Save button on the right (matching the mobile pattern for consistency)
   - Mobile: keep existing fixed bottom bar, polish spacing and typography

## What stays the same

- All data flow, Supabase calls, validation, bulk upload, template download, and save logic are untouched
- Route, props, hooks, and state remain identical
- No new dependencies; uses existing shadcn components, Tailwind tokens, and the `stat-tint-*` utilities already in `src/styles.css`

## Files touched

- `src/routes/daily-entry.tsx` — JSX/markup and class names only

## Out of scope

- Sidebar, other pages, database, permissions, or backend logic
