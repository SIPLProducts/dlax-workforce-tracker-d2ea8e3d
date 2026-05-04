import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "supervisor" | "manager" | "project_coordinator" | "project_manager";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithUserId: (loginId: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const fetchRoles = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (data) {
        const next = data.map((r) => r.role as AppRole);
        setRoles((prev) => {
          if (prev.length === next.length && prev.every((r, i) => r === next[i])) {
            return prev;
          }
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to fetch roles:", e);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Use setTimeout to avoid blocking the callback
          setTimeout(() => fetchRoles(session.user.id), 0);
        } else {
          setRoles([]);
        }
      }
    );

    // Then restore session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchRoles(session.user.id);
      }
      setLoading(false);
      setIsReady(true);
    }).catch(() => {
      setLoading(false);
      setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithUserId = async (loginId: string, password: string) => {
    const trimmed = loginId.trim().toLowerCase();
    if (!trimmed) return { error: new Error("Please enter your User ID") };
    const { data, error: lookupError } = await supabase.rpc("get_email_for_login_id", { _login_id: trimmed });
    if (lookupError) return { error: lookupError as unknown as Error };
    if (!data) return { error: new Error("Invalid User ID or password") };
    const { error } = await supabase.auth.signInWithPassword({ email: data, password });
    if (error) return { error: new Error("Invalid User ID or password") };
    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, hasRole, signIn, signInWithUserId, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
