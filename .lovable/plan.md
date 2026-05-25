
# DLAX UAT Test Scenarios — Excel Workbook

Generate a downloadable `.xlsx` file at `/mnt/documents/DLAX_UAT_Scenarios.xlsx` containing detailed user acceptance test cases covering every module of the DLAX application.

## Workbook structure

**Sheet 1 — Cover / Instructions**
- App: DLAX (Daily Labour Attendance & Tracking System)
- Client: KPC Infrastructure
- Version, tester name, environment, date columns
- Legend (Pass / Fail / Blocked / N/A), severity scale
- Role abbreviations (ADM, SUP, MGR, PC, PM)

**Sheet 2 — Test Summary Dashboard**
- Count of test cases per module
- Pass / Fail / Blocked counts using COUNTIF formulas against the Test Cases sheet
- Overall pass rate %

**Sheet 3 — Test Cases (main sheet)**
Columns: TC ID · Module · Sub-Module · Scenario · Priority · Role · Preconditions · Test Data · Steps · Expected Result · Actual Result · Status · Severity · Tester · Date · Remarks

**Sheet 4 — Defect Log**
Columns: Defect ID · Linked TC ID · Summary · Steps to reproduce · Severity · Priority · Status · Assigned to · Reported date · Closed date

**Sheet 5 — Sign-off**
Tester, Project Coordinator, Project Manager, Admin sign-off rows with date & signature columns.

## Modules covered (≈80–100 detailed test cases)

1. **Authentication & Session** — Login with User ID (not email), invalid credentials, password masking, case-insensitive User ID, auto-strip @domain, session persistence, logout, role-based route guards, unauthorized redirect.
2. **Dashboard** — KPI tiles render per role, project filter respects user_projects scoping, admin sees all projects.
3. **Masters – Projects** — Create / edit / deactivate, duplicate name validation, only admin/edit permission can mutate.
4. **Masters – Contractors** — CRUD, KPC is principal (not selectable as contractor), uniqueness.
5. **Masters – Departments** — CRUD, ordering, active flag.
6. **Masters – Categories** — CRUD (skilled / semi-skilled / unskilled etc.).
7. **Masters – Approval Config** — Toggle PC→PM 2-level approval per project, single-level fallback, save & reload.
8. **Daily Manpower Entry (Supervisor)** — Date picker, project/contractor/department/category selection, headcount + hours + overtime, edit before approval, lock after approval, validation (no negatives, hours ≤ 24), draft save.
9. **Individual Worker Attendance** — Name, check-in, check-out capture, totals match headcount, edit/delete.
10. **Approvals Workflow** — PC approves → status moves to PM; PM approves → final; reject with mandatory remarks bounces back; supervisor sees rejection reason; audit trail.
11. **Reports** — Project / contractor / department summaries, date range filter, Excel (.xlsx) export opens cleanly, totals reconcile with daily entries, non-admin scoping to assigned projects.
12. **User Management** — Create user (login_id, password, display name), uniqueness on login_id, assign system role(s), assign projects (user_projects), edit display name, deactivate.
13. **Custom Roles & Screen Permissions** — Create custom role, set per-screen permission (none/view/edit), edit existing role updates (no duplicate insertion), delete role, assign one custom role per user (replaces previous), permission immediately reflected in sidebar/routes.
14. **Per-user Project Access (RLS)** — Non-admin sees only assigned projects in dropdowns, reports, approvals; admin bypass; revoking project hides data instantly.
15. **Security / RLS** — Direct API attempt for non-permitted project returns no rows; non-admin cannot mutate masters; service-role operations only via server functions.
16. **Mobile / PWA** — Install via QR, mobile tab bar navigation, daily entry works on small viewport, offline behavior (graceful error).
17. **Cross-cutting** — Toast notifications on success/failure, loading states, empty states, form validation messages, browser back/forward preserves filters.

## Format & quality

- Arial 10pt, header row bold with light grey fill, frozen header row, auto-filter enabled on Test Cases sheet.
- Status column uses data validation dropdown: Pass / Fail / Blocked / Not Run / N/A.
- Priority dropdown: P1 / P2 / P3.
- Conditional formatting on Status: green=Pass, red=Fail, amber=Blocked.
- Column widths tuned for readability; wrap text on Steps and Expected Result.
- Summary sheet uses COUNTIF formulas (no hardcoded counts) — recalculated via LibreOffice before delivery.

## Deliverable

A single file: `DLAX_UAT_Scenarios.xlsx`, presented via `<presentation-artifact>` tag. Workbook will be QA'd by opening with openpyxl after recalculation to confirm zero formula errors and that all sheets render.
