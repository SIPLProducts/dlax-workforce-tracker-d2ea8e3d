## Plan

Update the Projects, Departments, and Categories screens to match the working Contractors screen table behavior.

### What will change
- Remove the sticky header styling from the table headers in:
  - Projects
  - Departments
  - Categories
- Keep the normal `<TableHeader>` structure, exactly like the Contractors table.
- Do not change table columns, data, filters, buttons, cards, or business logic.

### Expected result
- Headers will stay at the top of their table normally.
- Rows will no longer scroll behind or appear above the headers.
- Projects, Departments, and Categories will visually behave like Contractors.

### Technical details
- Replace the current sticky header class:
  - `sticky`
  - `top-[110px]`
  - `md:top-[126px]`
  - `z-[5]`
  - sticky background/shadow classes
- Use plain `<TableHeader>` in the affected screens.