import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Sticky page title bar. Sits flush under the TopBar (which is `sticky top-0` h-14)
 * and remains visible while page content scrolls.
 *
 * Uses negative margins to break out of the AppLayout content padding so the bar
 * spans full width, then re-applies its own horizontal padding.
 */
export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-14 z-10",
        "-mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8",
        "-mt-3 sm:-mt-4 md:-mt-6 lg:-mt-8",
        "mb-4 md:mb-6",
        "border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap px-3 sm:px-4 md:px-6 lg:px-8 py-3 md:py-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon ? <div className="shrink-0">{icon}</div> : null}
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {subtitle ? (
              <p className="hidden sm:block text-xs md:text-sm text-muted-foreground truncate">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
      </div>
    </div>
  );
}
