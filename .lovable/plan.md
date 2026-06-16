# Fix DLAX User Manual (dlax-user-manual.docx)

Three issues in the current 19-page manual:

1. **Login screenshot (page 4, Figure 1)** is a small/old capture. Replace it with the fresh full-resolution login screenshot (`image-187.png` — KPC Enterprise Edition, "Welcome back" card, Install on Mobile QR).
2. **Page 8 is mostly blank** — the §4.2 *Individual Worker Attendance* heading sits at the bottom of page 7, its paragraph + amber **Warning** callout flow alone onto page 8, then §5 starts on page 9.
3. **Page 10 is mostly blank** — the last row of the §5 action table + the blue **Note** callout sit alone on page 10, then §6 starts on page 11.

The user also wants the **Warning** note to stay on the same page as the §4.2 section it belongs to.

## Changes

**A. Replace login figure**
- In `word/media/`, swap the existing Figure 1 image with `image-187.png`.
- Keep the same relationship ID and caption ("Figure 1 — Login screen (accessible to all users)") so layout/numbering is unchanged.
- Resize ImageRun extent to preserve aspect ratio (image is ~16:8, fit to content width).

**B. Eliminate blank page 8 & keep §4.2 together**
- Remove the implicit/forced page break currently between §4.2 Warning and §5 *Approvals & Workflow*, so §5 flows up onto page 8 right after the Warning.
- Add `keepNext` on the §4.2 heading and `keepLines` on its paragraph + the Warning callout block, so the heading + paragraph + warning are guaranteed to render together on the same page (the user's main ask).
- Net result: §4.2 (heading + text + warning) lives on one page, and §5 begins on the same page filling the remaining space.

**C. Eliminate blank page 10**
- Remove the page break before §6 *Reports & Analytics* so §6 starts right after the §5 *Note* callout on what is currently page 10.
- Add `keepLines` on the last table row and the Note callout so the §5 closer stays intact.

**D. Re-paginate**
- After edits, manual will compress from 19 → ~17 pages. Footer "Page X of Y" auto-updates because it uses fields, not hard-coded numbers.

## Deliverable

Updated file saved to `/mnt/documents/dlax-user-manual.docx`, plus a re-rendered PDF preview so every page is visually verified (login figure correct, no blank pages, Warning on same page as §4.2).

## Technical notes

- Unpack with `extract_document.py`, edit `word/document.xml` (remove `<w:br w:type="page"/>` and section-break runs at the two locations; add `<w:keepNext/>` / `<w:keepLines/>` to the relevant `<w:pPr>`), swap the binary in `word/media/`, repack with `repack_document.py`.
- Validate with LibreOffice → PDF → page images and inspect pages 7–11 plus the login page before delivering.
