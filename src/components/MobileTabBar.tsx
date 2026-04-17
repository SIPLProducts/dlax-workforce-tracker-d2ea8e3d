import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, roles: [] as string[] },
  { to: "/daily-entry", label: "Daily Entry", icon: ClipboardList, exact: false, roles: ["admin", "supervisor"] },
  { to: "/reports", label: "Reports", icon: BarChart3, exact: false, roles: [] as string[] },
];

export function MobileTabBar() {
  const { user, hasRole } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const visible = tabs.filter((t) => t.roles.length === 0 || t.roles.some((r) => hasRole(r as any)));

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      aria-label="Primary mobile navigation"
    >
      <ul className="grid grid-cols-3">
        {visible.map((tab) => {
          const isActive = tab.exact ? location.pathname === tab.to : location.pathname.startsWith(tab.to);
          const Icon = tab.icon;
          return (
            <li key={tab.to}>
              <Link
                to={tab.to as any}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors min-h-[56px]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
