import { Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persistent app shell. Mounted once at the root.
 * - On /login: renders the page bare (no sidebar).
 * - Everywhere else: renders <AppLayout> (which hosts SidebarProvider + AppSidebar)
 *   so the sidebar stays mounted across navigation (no flash on link clicks).
 */
function ShellInner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isPublic = pathname === "/login";

  useEffect(() => {
    if (isPublic || loading || user) return;
    let cancelled = false;
    // Race-proof: React state may not yet reflect a freshly created session.
    // Re-check storage before bouncing to /login.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && !data.session) {
        navigate({ to: "/login" });
      }
    });
    return () => { cancelled = true; };
  }, [isPublic, loading, user, navigate, pathname]);

  if (isPublic) return <Outlet />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export function RootShell() {
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ShellInner />
    </ClientOnly>
  );
}
