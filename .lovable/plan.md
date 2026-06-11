## Goal

Refresh `dlax-user-manual.docx` to reflect the current roles & screen access, swap the Daily Entry Sheet figure, and add a new Project Assignment figure — using screenshots captured directly from the live app, framed with a visible border.

## Steps

1. **Capture screenshots from the live app**
   - Log in to the preview as an Admin user.
   - Navigate to `/daily-entry` → take full screenshot → save to `/tmp/daily-entry.png`.
   - Navigate to `/masters/assignments` → take full screenshot → save to `/tmp/project-assignments.png`.
   - Add a thin grey border (1–2 px, #CCCCCC) around each PNG using Pillow so the figures stand out on the page.

2. **Rewrite Section 3 — "Your Role Decides What You See"**
   - Replace the existing role table with the 5-role structure from the reference, with one short sentence per role:
     - **Project End User** – Daily Entry Screen — creates, edits and sends the daily sheet for approval (project specific).
     - **Project Manager** – Daily Entry Screen and Approval — enters data and gives final approval (project specific).
     - **Project Coordinator 1 & 2** – Contractor, Department, Categories and Project Assignment — create/edit master data and assign masters to multiple projects.
     - **Project Incharge** – Controls the entire flow — view-and-monitor across assigned projects.
     - **Administrator** – Creates users & roles — full control across all projects.

3. **Swap Daily Entry figure (Section 4)**
   - Replace the old Daily Entry image (`media/dacb87921fbe93b9e8255ba312320230b85942a6.png`) with the new bordered screenshot.
   - Keep caption "Figure 3 — Daily Manpower Entry".

4. **Add Project Assignment figure (Section 8.2)**
   - Insert the new bordered screenshot as a new Figure under §8.2.
   - Update §8.2 paragraph to explicitly say: *"The **Project Coordinator** can access and use the Project Assignment screen to link contractors, departments and worker categories to specific projects."*
   - Renumber subsequent figures.

5. **Rebuild the DOCX**
   - Unpack original, inject new media, edit XML for the roles table, figure swap, and §8.2 text.
   - Repack and validate.
   - Output to `/mnt/documents/dlax-user-manual.docx` and present via `<presentation-artifact>`.

6. **QA**
   - Convert the DOCX to PDF → render pages as images → visually verify the new screenshots, borders, roles table, and Project Assignment text.

## Notes

- No code changes to the app itself — this is a documentation update only.
- Screenshots will be captured at desktop viewport (≥1280 px wide) for legibility.
- Borders applied via Pillow `ImageOps.expand(img, border=2, fill="#cccccc")`.
