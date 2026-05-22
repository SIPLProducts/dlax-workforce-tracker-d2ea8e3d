import { type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { usePermissions } from "@/hooks/use-permissions";
import type { ScreenKey } from "@/lib/screens";
import { Loader2 } from "lucide-react";

type Props = {
  screen: ScreenKey | string;
  children: ReactNode;
};

/**
 * Wrap a route's content so users without `view` permission on `screen`
 * cannot reach it by typing the URL. Sidebar already hides the link; this
 * is the backstop.
 */
export function ScreenGuard({ screen, children }: Props) {
  const { canView, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canView(screen)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}
