

# Plan: Seed DLAX with Sample Data from KPC Manpower Registers

Based on your paper registers, KPC is the **principal company** (the organization using this app), NOT a contractor. Contractors are the parties KPC hires. I will insert realistic sample data matching your sheets.

## Data to Insert

### Project (1)
- **Construction of Integrated Township at BTPS, Manuguru** — Active, started 2024-01-15

### Contractors (12) — from your manpower register
1. Aarna Engineering Constructions
2. KAR Engineers and Contractors
3. Jai Mata Di Constructions
4. Mangalam Infratech
5. Abdur Rani & Co.
6. Pavan Kumar Gadhe
7. Padma Constructions
8. Sri Laxmi Constructions
9. SRI SRI Civil Works
10. Ravindra Reddy & Associates
11. Prashant Al Adam Contractor
12. S.S Engineers

### Departments (10) — work types from your sheet
1. Shuttering & Civil
2. Electrical
3. Painting
4. Plumbing
5. Water Proofing & Expansion Treatment
6. SITC Automation
7. Steel Structural Fabrication
8. Fire Fighting
9. MEP
10. Miscellaneous

### Worker Categories (7) — from your Daily Labor Report columns
1. Carpenter
2. Fitter/Rigger
3. Welder
4. Helper
5. Skilled Worker
6. Supervisor
7. Mason

### Daily Manpower Entries (~50-60 rows)
Entries for the last 7 days with realistic headcounts (matching the scale in your sheets — total ~400-600 workers/day across all contractors), covering various contractor + department + category combinations.

## Technical Approach
- Single database migration with INSERT statements using fixed UUIDs
- Master data first, then daily_manpower referencing those UUIDs
- Dashboard and reports will immediately show populated data

## What Will NOT Change
- KPC will not appear in the contractors table — it is the principal organization
- No code changes needed — only database inserts

