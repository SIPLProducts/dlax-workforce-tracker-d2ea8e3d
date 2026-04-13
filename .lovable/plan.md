
# DLAX — Daily Labour Attendance & Tracking System

## Overview
A workforce tracking application for construction projects that digitizes the paper-based manpower register shown in your images. It captures day-to-day headcount and attendance by Project, Contractor, and Department, with role-based access for Admin, Supervisors, and Managers.

---

## 1. Authentication & Roles
- Email/password login using Supabase Auth
- Three roles: **Admin** (manages master data + reports), **Supervisor** (enters daily data), **Manager** (view-only reports)
- Role-based navigation — supervisors see the daily entry form, managers see dashboards

## 2. Master Data Management (Admin)
Four master data modules, each with add/edit/delete and search:
- **Projects** — Name, location, start date, status (Active/Completed)
- **Contractors** — Company name, contact person, phone, license number
- **Departments** — Department/trade name (Civil, Electrical, Plumbing, Mechanical, etc.)
- **Worker Categories** — Category name (Skilled, Unskilled, Supervisor, Helper, etc.)

## 3. Daily Manpower Entry (Core Feature)
- **Date picker** at the top (defaults to today)
- **Select Project** → then see a grid/form to enter data
- For each **Contractor + Department + Worker Category** combination:
  - Number of workers (headcount)
  - Hours worked (regular + overtime)
  - Remarks/notes
- Option to also log **individual worker attendance** (name, check-in/out time) for detailed tracking
- **Copy previous day** button for quick entry when workforce doesn't change much
- Validation to prevent duplicate entries for same date/project/contractor/department

## 4. Dashboard (Home Page)
- **Today's summary cards**: Total workers across all projects, by project, by contractor
- **Trend chart**: Worker count over last 7/30 days
- Quick links to enter today's data or view reports

## 5. Reports
- **Daily Summary**: All projects' manpower for a selected date (similar to your paper sheet layout)
- **Project-wise Report**: Filter by project, date range — see contractor and department breakdown
- **Contractor-wise Report**: Filter by contractor — see how many workers deployed across projects
- **Department-wise Report**: Filter by department/trade
- **Export to Excel**: Download any report as .xlsx file

## 6. Database Design (Supabase)
- `projects`, `contractors`, `departments`, `worker_categories` — master tables
- `daily_manpower` — transactional table (project_id, contractor_id, department_id, category_id, date, headcount, hours_worked, overtime_hours, remarks)
- `worker_attendance` — optional individual tracking (worker_name, date, project_id, contractor_id, check_in, check_out)
- `user_roles` — separate roles table (admin, supervisor, manager)
- RLS policies to secure data access

## 7. Pages/Routes
- `/login` — Login page
- `/` — Dashboard with summary cards and charts
- `/daily-entry` — Daily manpower entry form
- `/masters/projects` — Project master CRUD
- `/masters/contractors` — Contractor master CRUD
- `/masters/departments` — Department master CRUD
- `/masters/categories` — Worker category master CRUD
- `/reports` — Reports page with filters and export
