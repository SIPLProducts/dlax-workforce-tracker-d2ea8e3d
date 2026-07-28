import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Presentation-only helpers used to render table rows as stacked cards on
 * phones. Tables stay authoritative from `md:` up — these components are
 * wrapped in `md:hidden` by callers.
 */

export function MobileCards({
  children,
  className,
  empty,
  isEmpty,
}: {
  children?: ReactNode;
  className?: string;
  empty?: ReactNode;
  isEmpty?: boolean;
}) {
  return (
    <div className={cn("md:hidden space-y-2 p-3", className)}>
      {isEmpty ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{empty ?? "No records found"}</p>
      ) : (
        children
      )}
    </div>
  );
}

export interface MobileField {
  label: string;
  value: ReactNode;
  /** Render across the full card width instead of the label/value grid. */
  full?: boolean;
}

export function MobileCard({
  title,
  subtitle,
  badge,
  fields = [],
  actions,
  className,
  onClick,
  ...rest
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  fields?: MobileField[];
  actions?: ReactNode;
  className?: string;
  onClick?: () => void;
} & Record<string, any>) {
  const visible = fields.filter((f) => f.value !== undefined && f.value !== null);
  return (
    <div
      {...rest}
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm",
        onClick && "cursor-pointer active:bg-muted/50",
        className
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{title}</div>
          {subtitle ? (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {visible.length > 0 ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-2 text-xs">
          {visible.map((f, i) => (
            <div key={`${f.label}-${i}`} className={cn("min-w-0", f.full && "col-span-2")}>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="truncate font-medium text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1 border-t pt-2">{actions}</div>
      ) : null}
    </div>
  );
}
