
User wants the pre-sales PPT branded with **Sharvi Infotech Pvt Ltd** and marked **Confidential**. I'll fold this into the existing pre-sales deck plan.

## Plan: DLAX Pre-Sales Deck — Sharvi Branded & Confidential

**Format**: Downloadable `.pptx`, generated via `pptxgenjs`, saved to `/mnt/documents/DLAX_PreSales_Deck.pptx`.

**Branding additions**:
- **Cover slide**: "Prepared by Sharvi Infotech Pvt Ltd" line under DLAX title; small "CONFIDENTIAL" tag top-right corner.
- **Master footer on every content slide**: left = "© 2026 Sharvi Infotech Pvt Ltd"; center = "DLAX — Pre-Sales Deck"; right = "CONFIDENTIAL · Page X".
- **Diagonal "CONFIDENTIAL" watermark** (light grey, ~15% opacity, rotated -30°) behind content on every slide.
- **Closing slide**: Sharvi Infotech contact block + reaffirmed confidentiality notice ("This document contains proprietary information of Sharvi Infotech Pvt Ltd. Not for redistribution.").

**Theme**: Midnight Executive — navy `#1E2761`, ice blue `#CADCFC`, safety-orange accent `#F59E0B`. Georgia headers, Calibri body.

**Slide outline (~15 slides)**:
1. Cover — DLAX hardhat icon, tagline, "Prepared by Sharvi Infotech Pvt Ltd", CONFIDENTIAL tag
2. Confidentiality & Disclaimer notice (full slide)
3. The Problem — paper registers, missing data, billing disputes
4. Introducing DLAX — Capture · Track · Report
5. Who It's For — KPC-style principals, EPC contractors, PMs, supervisors
6. Key Capabilities — 6-tile grid
7. Live Dashboard *(screenshot)*
8. Daily Entry Workflow *(screenshot)*
9. Master Data Management *(screenshot)*
10. Reports & Drill-Down *(screenshot)*
11. Role-Based Security — Admin / Supervisor / Manager + RLS
12. Tech & Deployment — Cloud, mobile-responsive, secure
13. Business Value — 80% faster reporting · 100% audit trail · Zero paper
14. Implementation & Onboarding — 4-step timeline
15. Contact / CTA — Sharvi Infotech contact block + confidentiality reaffirmation

**Screenshots**: Capture Dashboard, Daily Entry, Masters/Projects, Reports from preview URL via browser tools. Fallback to icon-only design if auth blocks capture.

**QA**: Convert each slide to image, inspect for overflow/overlap/contrast issues, fix and re-render until clean.

**Deliverable**: `<lov-artifact>` tag pointing to `/mnt/documents/DLAX_PreSales_Deck.pptx`.
