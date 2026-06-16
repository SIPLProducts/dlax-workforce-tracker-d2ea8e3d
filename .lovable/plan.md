# Update DLAX User Manual: Add OT Entry & "Enter OT?" Popup

Extend the existing `/mnt/documents/dlax-user-manual.docx` with two new pieces of documentation. Edit via unpack → XML edit → repack (same workflow as last revision).

## A. Add "Enter OT?" Popup section (under §4 Daily Manpower Entry)

Insert a new subsection **§4.3 "Enter OT?" Prompt** right after §4.2 Individual Worker Attendance:

- **When it appears** — After saving a Daily Manpower sheet for *yesterday's* date (the standard supervisor workflow), a dialog automatically opens asking *"Would you like to enter OT for the previous date?"*
- **Yes** — Navigates to the OT Entry screen, pre-filled with the same project and date, so overtime hours can be captured immediately after the headcount.
- **No** — Closes the dialog; OT can still be entered later from the OT Entry screen in the sidebar.
- Blue **Note** callout: the popup is a convenience prompt only — skipping it does not block saving or sending the Daily sheet for approval.
- Capture a fresh screenshot of the dialog and embed it.

## B. Add new chapter "§5 OT (Overtime) Entry" (renumber later chapters)

New full chapter inserted after Daily Manpower, covering the OT Entry screen (`src/routes/ot-entry.tsx`). Existing chapters 5–8 shift down by one number; footer/TOC page numbers update on repack.

Contents:

1. **Purpose** — Capture overtime hours per project, per day, broken down by department and category, mirroring the Daily Manpower layout.
2. **Accessing the screen** — Sidebar → OT Entry, or via the *Enter OT?* prompt after saving Daily Manpower.
3. **Two tabs / modes**
   - **Entry** — Blank/editable OT grid for the selected project + date.
   - **Saved Entries** — Browse mode listing previously saved OT sheets with status badges (Draft / Pending PC / Pending PM / Approved / Rejected) and View / Edit / Send to Approval actions.
4. **Filling the grid** — Project picker, date picker (defaults to yesterday), OT hours per dept × category cell, remarks, weather.
5. **Save / Send to Approval** — Same 2-level PC → PM approval flow as Daily Manpower; rejected sheets return to Draft with remarks.
6. **Orphan cells** — If a department/category was removed from masters after saving, previously-entered OT values are preserved and shown in an "Unassigned (saved earlier)" group; amber **Warning** callout explains this.
7. **Permissions** — Gated by the `ot_entry` screen permission; Managers see read-only.
8. Two screenshots: blank OT Entry grid and Saved OT Entries list.

## C. Technical execution

1. Unpack `/mnt/documents/dlax-user-manual.docx` with `extract_document.py`.
2. Edit `word/document.xml`:
   - Insert §4.3 paragraph block + Note callout + figure (popup screenshot) between current §4.2 Warning and old §5 heading.
   - Insert new §5 *OT (Overtime) Entry* chapter heading + body + Warning callout + two figures.
   - Renumber existing §5 Approvals → §6, §6 Reports → §7, §7 Notifications → §8, §8 Glossary → §9 (or whatever current trailing chapters are) in headings and any cross-references.
   - Apply `keepNext` / `keepLines` to the new callouts and figure paragraphs so they don't create blank pages.
3. Take fresh screenshots from the running app:
   - `Enter OT?` dialog (trigger via daily-entry save on yesterday's date).
   - OT Entry blank grid.
   - OT Entry → Saved Entries tab list.
   Drop PNGs into `word/media/`, add relationships in `word/_rels/document.xml.rels`, add `<Default Extension="png" ...>` if not already in `[Content_Types].xml`.
4. Repack with `repack_document.py` to a new versioned file `/mnt/documents/dlax-user-manual-v3.docx`.
5. Convert to PDF + page images via LibreOffice and visually QA every page — verify renumbering, no blank pages, callouts on same page as their section, screenshots sharp and correctly sized (~6"–6.5" wide).
6. Deliver via `<presentation-artifact>` once QA is clean.

## Out of scope

- No app/UI code changes — manual content only.
- No restructuring of existing chapters beyond renumbering.
