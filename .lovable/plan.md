## Goal

Add red highlight rectangles to **Figure 3 — Daily Manpower Entry** in `dlax-user-manual.docx`, matching the style already used on Figure 4 (Approvals): a red box around the sidebar nav item and a red box around the page header.

## Changes

1. Locate the current Figure 3 image inside `word/media/` (the Daily Entry screenshot added last turn).
2. Using Pillow, draw two thin red rectangles (≈2 px, colour `#E11D2A`, no fill) on a copy of the image:
   - Around the **"Daily Entry"** item in the left sidebar.
   - Around the **"Daily Manpower Entry / Daily Labour Attendance Register"** title block at the top of the main content area.
3. Save the annotated PNG over the existing media file (same filename, same `rId`) so the document layout, caption ("Figure 3 — Daily Manpower Entry") and size are untouched.
4. Repack `dlax-user-manual.docx` to `/mnt/documents/dlax-user-manual.docx`.
5. QA: render the page as an image and verify both red boxes sit on the right elements with clean edges and no overlap with surrounding text.

## Notes

- No other figures, text, or layout changes.
- Box coordinates derived empirically from the screenshot by inspecting pixel positions of "Daily Entry" in the sidebar and the "Daily Manpower Entry" header.
- If the boxes look misplaced in QA, adjust coordinates and re-render before finalising.
