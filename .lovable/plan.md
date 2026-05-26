# DLAX User Manual — PDF with Screenshots

A single downloadable PDF covering all 5 roles (Admin, Supervisor, Manager, Project Coordinator, Project Manager), with screenshots auto-captured from the live preview.

## Structure

1. **Cover page** — DLAX title, KPC branding, version, date
2. **Introduction** — what DLAX is, login basics (User ID, not email)
3. **Common screens** (shared by all roles) — Login, Dashboard, Top bar / sidebar
4. **Role sections** (one per role, ~1–2 pages each):
   - Who it's for / responsibilities
   - Screens they can access (from `APP_SCREENS` + `SYSTEM_BASELINE` in `use-permissions.tsx`)
   - Step-by-step for their main workflow
   - Annotated screenshots
5. **Appendix** — Approval workflow diagram (PC → PM), troubleshooting (forgot password, no project access)

### Per-role workflows

| Role | Main workflow documented |
|------|--------------------------|
| Admin | User management, project/contractor/department masters, approval config, project assignments |
| Supervisor | Daily Entry — add headcount, hours, OT, individual worker check-in/out |
| Manager | View Dashboard + Reports, export to Excel |
| Project Coordinator | Approvals queue → L1 approve/reject with remarks |
| Project Manager | Approvals queue → L2 final approve/reject |

## How screenshots will be captured

I need login credentials to capture role-specific screens. I'll ask you for these once we're in build mode:

- 1 test account per role (User ID + password), OR
- One admin account + I'll capture every screen as admin (most screens look the same; I'll annotate role-restricted views textually)

The browser will navigate to each route, capture a screenshot, and the script will embed them into the PDF using ReportLab. All output saved to `/mnt/documents/DLAX-User-Manual.pdf`.

## Technical

- ReportLab (Python) for PDF generation — supports embedded images, headings, TOC
- Browser automation tool to capture each screen at 1280×800
- Visual QA: convert PDF pages to images and review before delivering
- Single deliverable: `/mnt/documents/DLAX-User-Manual.pdf` exposed via `<presentation-artifact>`

## Out of scope

- No code changes to the app
- No DOCX / PPTX versions (PDF only, as chosen)
- Screenshots reflect current preview UI; will need regeneration if UI changes later
