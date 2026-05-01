import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Users,
  Layers,
  Tag,
  BarChart3,
  FileSpreadsheet,
  LogOut,
  HardHat,
  UserCog,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, screen: "dashboard" },
  { to: "/daily-entry", label: "Daily Entry", icon: ClipboardList, screen: "daily_entry" },
];

const masterItems = [
  { to: "/masters/projects", label: "Projects", icon: Building2, screen: "masters_projects" },
  { to: "/masters/contractors", label: "Contractors", icon: Users, screen: "masters_contractors" },
  { to: "/masters/departments", label: "Departments", icon: Layers, screen: "masters_departments" },
  { to: "/masters/categories", label: "Categories", icon: Tag, screen: "masters_categories" },
];

const reportItems = [
  { to: "/reports", label: "Reports", icon: BarChart3, screen: "reports" },
];

const adminItems = [
  { to: "/users", label: "User Management", icon: UserCog, screen: "user_management" },
];

export function AppSidebar() {
  const { user, roles, signOut } = useAuth();
  const { canView } = usePermissions();
  const location = useLocation();

  const canSee = (screen: string) => canView(screen);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <HardHat className="h-7 w-7 text-sidebar-primary" />
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight">DLAX</h1>
            <p className="text-xs text-sidebar-foreground/60">Labour Tracking</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter((i) => canSee(i.screen)).map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                    <Link to={item.to as any}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {masterItems.some((i) => canSee(i.screen)) && (
          <SidebarGroup>
            <SidebarGroupLabel>Master Data</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {masterItems.filter((i) => canSee(i.screen)).map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                      <Link to={item.to as any}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportItems.filter((i) => canSee(i.screen)).map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                    <Link to={item.to as any}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminItems.some((i) => canSee(i.screen)) && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.filter((i) => canSee(i.screen)).map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                      <Link to={item.to as any}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          <p className="text-xs text-sidebar-primary font-medium capitalize">{roles.join(", ") || "No role"}</p>
          <Button variant="ghost" size="sm" className="justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
