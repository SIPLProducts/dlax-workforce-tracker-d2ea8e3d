import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { KpcLogo } from "@/components/KpcLogo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ChevronRight, LogOut, User } from "lucide-react";
import { useMemo } from "react";

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  "daily-entry": "Daily Entry",
  "approvals": "Approvals",
  "reports": "Reports",
  "users": "User Management",
  "masters": "Master Data",
  "projects": "Projects",
  "contractors": "Contractors",
  "departments": "Departments",
  "categories": "Categories",
};

function titleize(seg: string) {
  return ROUTE_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, signOut } = useAuth();
  const { mode } = useTheme();

  const crumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return [{ label: "Dashboard", href: "/" }];
    return parts.map((seg, i) => ({
      label: titleize(seg),
      href: "/" + parts.slice(0, i + 1).join("/"),
    }));
  }, [pathname]);

  const initials = (user?.email?.[0] || "U").toUpperCase();
  const roleLabel = roles.includes("admin") ? "Admin" : roles[0] || "User";

  return (
    <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <SidebarTrigger />

        {/* Inline brand on mobile only — sidebar holds it on desktop */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="rounded-md bg-sidebar px-2 py-1">
            <KpcLogo variant="on-dark" className="h-4" />
          </div>
          <span className="font-bold text-foreground tracking-tight">DLAX</span>
        </div>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          {crumbs.map((c, i) => (
            <div key={c.href} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
              <span className={i === crumbs.length - 1 ? "text-foreground font-medium truncate" : "truncate"}>
                {c.label}
              </span>
            </div>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 pl-2 pr-2 sm:pr-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs font-medium text-foreground truncate max-w-[140px]">{user?.email}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{roleLabel}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                <span className="truncate">{user?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                Mode: {mode === "dark" ? "Dark" : "Light"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
