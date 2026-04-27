import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { ScreenKey, PermissionLevel } from "@/lib/screens";

// System role baseline permissions
const SYSTEM_BASELINE: Record<string, Partial<Record<ScreenKey, PermissionLevel>>> = {
  admin: {
    dashboard: "edit", daily_entry: "edit", reports: "edit",
    masters_projects: "edit", masters_contractors: "edit",
    masters_departments: "edit", masters_categories: "edit",
    user_management: "edit",
  },
  supervisor: {
    dashboard: "view", daily_entry: "edit", reports: "view",
  },
  manager: {
    dashboard: "view", reports: "view",
  },
};

const RANK: Record<PermissionLevel, number> = { none: 0, view: 1, edit: 2 };

function maxPerm(a: PermissionLevel, b: PermissionLevel): PermissionLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

export function usePermissions() {
  const { user, roles, loading: authLoading } = useAuth();
  const [perms, setPerms] = useState<Record<string, PermissionLevel>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPerms({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Start with system baseline
        const merged: Record<string, PermissionLevel> = {};
        roles.forEach((r) => {
          const baseline = SYSTEM_BASELINE[r] || {};
          Object.entries(baseline).forEach(([k, v]) => {
            merged[k] = merged[k] ? maxPerm(merged[k], v as PermissionLevel) : (v as PermissionLevel);
          });
        });

        // Layer custom-role screen permissions
        const { data: ucr } = await supabase
          .from("user_custom_roles")
          .select("role_id")
          .eq("user_id", user.id);
        const roleIds = (ucr || []).map((r: any) => r.role_id);
        if (roleIds.length > 0) {
          const { data: rsp } = await supabase
            .from("role_screen_permissions")
            .select("screen_key, permission")
            .in("role_id", roleIds);
          (rsp || []).forEach((row: any) => {
            const lvl = row.permission as PermissionLevel;
            if (lvl === "none") return;
            merged[row.screen_key] = merged[row.screen_key] ? maxPerm(merged[row.screen_key], lvl) : lvl;
          });
        }

        if (!cancelled) setPerms(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, roles, authLoading]);

  const get = (key: ScreenKey | string): PermissionLevel => (perms[key] as PermissionLevel) || "none";
  const canView = (key: ScreenKey | string) => RANK[get(key)] >= RANK.view;
  const canEdit = (key: ScreenKey | string) => RANK[get(key)] >= RANK.edit;

  return { perms, loading, get, canView, canEdit };
}
