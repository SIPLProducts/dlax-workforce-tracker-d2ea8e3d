## Goal

Make the page title (e.g. "Dashboard — Workforce overview…", "Daily Entry", "Approvals", "Reports", "User Management", "Master Data") stay frozen at the top of every screen so it remains visible while the page content scrolls underneath.

## Approach

Introduce a reusable `PageHeader` component that renders a sticky bar directly under the existing `TopBar`. It will hold the page title, optional subtitle, and an optional right-side actions slot (e.g. the dashboard's 7d/14d/30d/90d switcher). Then replace the current inline title blocks on each route with `<PageHeader …>`.

Behavior:
- Sticks just below the 56px `TopBar` (`top-14`), spans full width, has card/blur background + bottom border to match `TopBar` styling.
- z-index below `TopBar` (z-10) so dropdowns from `TopBar` still overlay it.
- Title uses the existing tracking-tight bold style; subtitle uses muted-foreground.
- Mobile: title shrinks to `text-lg`, subtitle hides if too long.
- Filter cards (date pickers, project/contractor selects on Dashboard & Reports) remain in normal flow and scroll away — only the title bar freezes. (If you want the filters frozen too, say so and I'll include them.)

## Files

**New**
- `src/components/PageHeader.tsx` — sticky title bar component with `title`, `subtitle`, `actions` props.

**Edited** (replace existing title blocks with `<PageHeader>`)
- `src/routes/index.tsx` (Dashboard — move 7d/14d/30d/90d tabs into `actions`)
- `src/routes/daily-entry.tsx`
- `src/routes/approvals.tsx`
- `src/routes/reports.tsx`
- `src/routes/users.tsx`
- `src/routes/masters.projects.tsx`
- `src/routes/masters.contractors.tsx`
- `src/routes/masters.departments.tsx`
- `src/routes/masters.categories.tsx`
- `src/routes/masters.approvals.tsx`

**Minor adjustment**
- `src/components/AppLayout.tsx` — reduce the wrapping `<div>` top padding so `PageHeader` can sit flush under `TopBar`; page content padding preserved below the header.

## Out of scope

- No change to filter cards, tables, or business logic.
- No change to `TopBar` breadcrumbs or theme switcher.
