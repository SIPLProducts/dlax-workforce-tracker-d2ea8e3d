import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

function AuthGuardInner({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || user) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && !data.session) {
        navigate({ to: "/login" });
      }
    });
    return () => { cancelled = true; };
  }, [loading, user, navigate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) return null;

  return <AppLayout>{children}</AppLayout>;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  return (
    <ClientOnly fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <AuthGuardInner>{children}</AuthGuardInner>
    </ClientOnly>
  );
}
