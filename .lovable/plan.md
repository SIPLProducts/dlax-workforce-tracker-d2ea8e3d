## Goal

Produce a beautifully designed **DLAX User Manual (.docx + .pdf)** that mirrors the visual language of the `HBL_MRB_User_Manual.docx` reference, but with full DLAX content (already in your existing manual). Deliver both files to `/mnt/documents/` and embed the actual DLAX screenshots from the uploaded doc.

## Visual style (copied 1:1 from HBL MRB)

- **Cover page** — Sharvi Infotech logo top-left, KPC logo top-right; centered navy title block ("Daily Labour Attendance (DLAX) — Web Application / User Manual Simple Step-by-Step Guide / For KPC"); large KPC mark; "Submitted by Sharvi Infotech" with Sharvi logo.
- **Color system** — Navy `#1F3864` for headings, accent blue `#2E75B6` for rules, dark-navy `#203864` table headers with white text, alt-row `#F2F6FB`, body charcoal `#333333`.
- **Typography** — Calibri throughout. H1 28pt bold navy + thin blue underline rule, H2 16pt bold navy, H3 13pt bold navy, body 11pt, captions 9pt muted.
- **Page chrome** — 1" margins, footer with `© 2026 KPC DLAX  |  Confidential — for internal  |  Page N` using tab stops + page number field.
- **Callouts** — light-blue "i Note" box, green "OK Tip" box, amber "Warning" box (rounded shaded paragraph with a colored label run).
- **Numbered step blocks** — solid blue square with white number, bold step title, description below; used for login, daily entry, approval flows.
- **Role table & masters tables** — navy header, alt rows, hairline borders, comfortable cell padding.
- **System-fits-together diagram** — colored boxes (Supervisor → Coordinator L1 → Project Manager L2 → Reports) with arrows, mirroring HBL's SAP/MRB/Users diagram.
- **Screenshots** — embed the existing DLAX screenshots already extracted from your previous manual (`parsed-documents://…/img_pX_Y.jpg`) at content width, with figure captions in muted italics.

## Document structure (DLAX content, MRB layout)

1. Cover
2. Welcome — what DLAX is, who it's for, "How the system fits together" diagram, role legend, OK Tip callout
3. What's Inside (TOC, numbered)
4. Getting Started — login screen walk-through with numbered step blocks
5. Your Role Decides What You See — role table (Admin / Supervisor / Manager / Project Coordinator L1 / Project Manager L2) + i Note
6. Navigating the Application — sidebar, top bar, theme switcher, dashboard tour
7. Daily Manpower Entry — numbered steps, screenshot, "Send to Approval" callout, Individual Worker Attendance subsection
8. Approvals & Workflow — L1 / L2 flow, approve/reject table ("What each action means"), routing diagram, rejection rules note
9. Masters (Admin) — Projects, Contractors, Departments, Categories, Project Assignments, Approval Settings (each with screenshot + bullet walk-through)
10. User Management — create users, system roles vs custom roles, project assignment
11. Reports & Analytics — tabs, filters, KPIs, CSV export
12. Common Questions & Troubleshooting — Q&A list styled like MRB section 9
13. Glossary — DLAX terms (Sheet ID, L1, L2, Headcount, Deficiency Manpower, etc.)

## How it's built

- Use the **docx skill** (`docx-js` via Node) to generate `dlax-user-manual.docx` with all the styles above defined once in `Document.styles`.
- Reuse the screenshot JPGs already extracted from your current DLAX docx (`parsed-documents://…/img_p*.jpg`) — embedded as PNG/JPG `ImageRun`s, no regeneration needed.
- Use the existing Sharvi & KPC logos from those same extracted images for the cover and footer.
- After generation, convert to PDF with LibreOffice and render every page as JPG for **mandatory visual QA** — fix any overflow / overlap / missing-image issues, re-pack, re-verify, then deliver.

## Deliverables

- `/mnt/documents/dlax-user-manual.docx`
- `/mnt/documents/dlax-user-manual.pdf`
- Inline `<presentation-artifact>` links for both, plus a short summary of QA performed.

## Out of scope

- No changes to the DLAX app code, routes, schema, or self-host install scripts in this task. This is a document-generation task only.
