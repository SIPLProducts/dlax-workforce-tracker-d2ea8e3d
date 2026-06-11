## Goal

Apply three global corrections to `dlax-user-manual.docx` and republish to `/mnt/documents/dlax-user-manual.docx`.

## Changes

1. **Remove the "Forgot your password" Note box** (the blue i-Note shown under Figure 1 — Login screen). Delete the entire note shape/paragraph; leave Figure 1 and its caption intact.

2. **Replace "Supervisor" with "Project End User" everywhere in the manual**, matching the new roles table. Specific spots already known:
   - Welcome → "How the system fits together" diagram: first block label "Supervisor / Daily Entry" → **"Project End User / Daily Entry"**.
   - Welcome intro paragraph: "supervisors enter manpower…" → "project end users enter manpower…"; "a Supervisor entering today's headcount" → "a Project End User entering today's headcount".
   - §4 Daily Manpower Entry → "Who: Site Supervisor (or any user with Daily Entry access)" → **"Who: Project End User (or any user with Daily Entry access)"**.
   - Any other occurrence of "Supervisor" / "Site Supervisor" in body text, captions, tips, or notes — global find & replace, preserving capitalisation.

3. **Project Coordinator no longer approves — only Project Manager approves.** Rewrite approval references throughout:
   - §5 Approvals & Workflow intro: "DLAX supports configurable multi-level sequential approval, typically L1 (Project Coordinator) → L2 (Project Manager)…" → **"In DLAX, submitted daily sheets are reviewed and approved by the Project Manager. The Project Coordinator manages master data and project assignments but does not approve daily sheets."**
   - Welcome diagram: replace the purple "Coordinator (L1) / First Review" block with a single approval step — **"Project Manager / Approval"** — and drop the L2 block (diagram becomes: Project End User → Project Manager → Dashboard & Reports). The "Approved" tip stays.
   - §4 step 4 "Send for approval": "The sheet moves to **Pending L1**…" → "The sheet moves to **Pending Approval**…".
   - Roles table (already correct — Project Manager approves, Project Coordinator handles masters): leave as-is.
   - Any other "L1 / L2", "Coordinator approval", "first review", "two-level approval" wording → rewrite as single Project Manager approval.

## Technical steps

1. Unpack `dlax-user-manual.docx` → `unpacked/`.
2. Edit `word/document.xml`:
   - Delete the Note paragraph(s) under Figure 1 (identify by "Forgot your password" text run + surrounding shape/table wrapper).
   - String-replace Supervisor → Project End User (and lowercase variants) in body runs.
   - Rewrite §5 intro paragraph and §4 step-4 sentence.
   - Update the Welcome flow diagram: remove the Coordinator block (and one arrow), retext the remaining block to "Project Manager / Approval", and rename the first block to "Project End User".
3. Repack and validate.
4. QA: convert to PDF → render pages → verify the Note is gone, Welcome diagram has 3 blocks, §4/§5 wording is updated, and no stray "Supervisor" / "L1" / "L2" / "Coordinator approval" remain (grep the extracted text).
5. Save to `/mnt/documents/dlax-user-manual.docx` and present via `<presentation-artifact>`.

## Notes

- Documentation-only change. No app code touched.
- Roles table (already updated last turn) is consistent with these edits and stays.
- Approval workflow feature in the app itself is unchanged — only the manual's wording is corrected per your instruction.
