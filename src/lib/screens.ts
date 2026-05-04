// Screens that can be permission-controlled per custom role.
// `key` is stored in role_screen_permissions.screen_key.
export const APP_SCREENS = [
  { key: "dashboard", label: "Dashboard", path: "/" },
  { key: "daily_entry", label: "Daily Entry", path: "/daily-entry" },
  { key: "approvals", label: "Approvals", path: "/approvals" },
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "masters_projects", label: "Projects (Master)", path: "/masters/projects" },
  { key: "masters_contractors", label: "Contractors (Master)", path: "/masters/contractors" },
  { key: "masters_departments", label: "Category of Labour (Master)", path: "/masters/departments" },
  { key: "masters_categories", label: "Categories (Master)", path: "/masters/categories" },
  { key: "masters_approval_config", label: "Approval Settings (Master)", path: "/masters/approvals" },
  { key: "user_management", label: "User Management", path: "/users" },
] as const;

export type ScreenKey = (typeof APP_SCREENS)[number]["key"];
export type PermissionLevel = "none" | "view" | "edit";
