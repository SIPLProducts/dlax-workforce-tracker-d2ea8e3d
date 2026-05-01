## Goal

Produce a polished, client-ready **Techno-Commercial Proposal** for the **DLAX (Daily Labour Attendance & Tracking System)** as a downloadable Word (.docx) file in `/mnt/documents/`, addressed to **KPC Infrastructure**, sized for a medium rollout (~25 projects / ~5,000 workers), with **SaaS subscription pricing in INR**.

No application code will be modified.

## Deliverable

- `DLAX_Techno_Commercial_Proposal_KPC.docx` in `/mnt/documents/`
- Generated with `docx-js` (Arial body, Georgia headings, KPC-style amber/navy accents matching the app's brand)
- A4 page size, professional cover page, page numbers, table of contents

## Document Structure

1. **Cover Page** — DLAX logo block, title "Techno-Commercial Proposal", prepared for KPC Infrastructure, prepared by Sharvi Infotech Pvt Ltd, date, version, confidentiality notice.
2. **Executive Summary** — One-page snapshot of the offer and value proposition.
3. **About DLAX** — Product overview, problem it solves (paper register pain), target outcomes.
4. **Understanding KPC's Requirements** — Multi-project workforce visibility, 3rd-party contractor governance, role-based control, audit trail.
5. **Solution Overview (Technical)**
   - Architecture diagram (text/ASCII): Web App → Lovable Cloud (Postgres + Auth + RLS) → Reports
   - Modules: Daily Manpower Tracking, Individual Worker Attendance (check-in/out), Masters (Projects, Contractors, Departments, Categories), User & Role Management, Reporting & Excel Export, Per-user project access scoping
   - Roles & permissions matrix (Admin / Supervisor / Manager)
   - Security: Role-based Row Level Security, User-ID based login, encrypted transport, daily backups
   - Mobile-friendly PWA — install via QR
6. **Implementation Plan** — 6-week phased rollout (Discovery → Configuration → UAT → Pilot Project → Full Rollout → Hypercare).
7. **Service Levels (SLA)** — Uptime 99.5%, support windows, response/resolution matrix (P1–P4), escalation path.
8. **Training & Onboarding** — Admin train-the-trainer, supervisor field training, quick-reference guides, video walkthroughs.
9. **Commercial Proposal (INR)**
   - **One-time Implementation Fee:** ₹1,50,000 (configuration, masters setup, training, pilot)
   - **SaaS Subscription (per named user / month):**
     - Supervisor / Field user: **₹399 / user / month**
     - Manager (view-only): **₹299 / user / month**
     - Admin: **₹599 / user / month**
   - **Indicative monthly estimate** for KPC (assumes ~50 supervisors, 15 managers, 5 admins): ~₹27,420 / month
   - **Annual contract discount:** 10% on prepaid annual
   - Inclusions: hosting, backups, updates, standard support
   - Exclusions: custom integrations, on-site training travel, hardware
   - Taxes: GST extra at actuals
10. **Assumptions & Dependencies** — Internet on sites, named-user model, KPC provides masters data, single time-zone (IST).
11. **Commercial Terms** — Payment milestones, validity (30 days), invoicing cycle, termination, data ownership & exit clause.
12. **Why Sharvi Infotech** — Brief credentials block.
13. **Acceptance Page** — Signature blocks for KPC and Sharvi Infotech.
14. **Annexures** — Screen list, sample report layout, glossary.

## Generation Approach

1. Write a Node.js script using `docx` (already available via skill).
2. Embed all formatting per the docx skill rules: explicit A4 page size, dual-width tables (DXA), Heading1/2 style overrides, numbering config for bullets, header/footer with page numbers, KPC color palette (`#1E2761` navy, `#F59E0B` amber).
3. Save to `/mnt/documents/DLAX_Techno_Commercial_Proposal_KPC.docx`.
4. **Mandatory QA**: Convert to PDF via LibreOffice, render each page to JPG, visually inspect every page for layout issues (overflow, broken tables, missing content), fix and re-render until clean. Delete QA images afterwards.
5. Emit a `<lov-artifact>` tag so you can download it.

## Out of Scope

- No changes to the DLAX application itself.
- No new database tables, RLS policies, or UI changes.
- No PDF or PPTX version (only .docx as you selected).

After approval, I'll generate, QA, and deliver the document in one pass.