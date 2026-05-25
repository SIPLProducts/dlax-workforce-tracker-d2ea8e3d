import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Users,
  Layers,
  Tag,
  BarChart3,
  LogOut,
  UserCog,
  CheckCircle2,
  ShieldCheck,
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
import { KpcLogo } from "@/components/KpcLogo";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, screen: "dashboard" },
  { to: "/daily-entry", label: "Daily Entry", icon: ClipboardList, screen: "daily_entry" },
  { to: "/approvals", label: "Approvals", icon: CheckCircle2, screen: "approvals" },
];

const masterItems = [
  { to: "/masters/projects", label: "Projects", icon: Building2, screen: "masters_projects" },
  { to: "/masters/contractors", label: "Contractors", icon: Users, screen: "masters_contractors" },
  { to: "/masters/departments", label: "Departments", icon: Layers, screen: "masters_departments" },
  { to: "/masters/categories", label: "Categories", icon: Tag, screen: "masters_categories" },
  { to: "/masters/approvals", label: "Approval Settings", icon: ShieldCheck, screen: "masters_approval_config" },
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
  const [customRoleNames, setCustomRoleNames] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) { setCustomRoleNames([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_custom_roles")
        .select("custom_roles(name)")
        .eq("user_id", user.id);
      if (cancelled) return;
      const names = (data || [])
        .map((r: any) => r.custom_roles?.name)
        .filter(Boolean) as string[];
      setCustomRoleNames(names);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const isAdmin = roles.includes("admin");
  const roleLabel = isAdmin
    ? "Admin"
    : customRoleNames.length > 0
      ? customRoleNames.join(", ")
      : roles.join(", ") || "No role";

  const canSee = (screen: string) => canView(screen);


  return (
    <Sidebar>
      <SidebarHeader className="p-4 bg-brand-gradient">
        <div className="flex flex-col gap-3">
          <KpcLogo variant="on-dark" className="h-7 w-auto" />
          <div className="border-t border-sidebar-border pt-3">
            <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight leading-none">DLAX</h1>
            <p className="text-[11px] text-sidebar-foreground/60 mt-1 uppercase tracking-wider">Daily Labour Attendance</p>
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

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
              {(user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-sidebar-foreground truncate font-medium">{user?.email}</p>
              <p className="text-[10px] text-sidebar-primary font-semibold uppercase tracking-wider capitalize">{roleLabel}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
