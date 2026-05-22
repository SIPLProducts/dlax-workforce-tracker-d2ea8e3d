import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { ScreenKey, PermissionLevel } from "@/lib/screens";

// System role baseline permissions (only used when the user has NO custom role).
const SYSTEM_BASELINE: Record<string, Partial<Record<ScreenKey, PermissionLevel>>> = {
  admin: {
    dashboard: "edit", daily_entry: "edit", approvals: "edit", reports: "edit",
    masters_projects: "edit", masters_contractors: "edit",
    masters_departments: "edit", masters_categories: "edit",
    masters_approval_config: "edit",
    user_management: "edit",
  },
  supervisor: {
    dashboard: "view", daily_entry: "edit", reports: "view",
  },
  manager: {
    dashboard: "view", reports: "view",
  },
  project_coordinator: {
    dashboard: "view", approvals: "edit", reports: "view",
  },
  project_manager: {
    dashboard: "view", approvals: "edit", reports: "view",
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

  const userId = user?.id;
  const rolesKey = roles.slice().sort().join(",");

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setPerms({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const merged: Record<string, PermissionLevel> = {};
        const userRoles = rolesKey.split(",").filter(Boolean);
        const isAdmin = userRoles.includes("admin");

        // Load custom role assignments first — they take precedence over
        // system-role baselines for non-admin users.
        const { data: ucr } = await supabase
          .from("user_custom_roles")
          .select("role_id")
          .eq("user_id", userId);
        const roleIds = (ucr || []).map((r: any) => r.role_id);
        const hasCustomRole = roleIds.length > 0;

        // Admin always gets the full admin baseline (cannot be locked out).
        // Non-admins with NO custom role fall back to system-role baselines.
        // Non-admins WITH a custom role are governed only by the custom role.
        if (isAdmin || !hasCustomRole) {
          userRoles.forEach((r) => {
            const baseline = SYSTEM_BASELINE[r] || {};
            Object.entries(baseline).forEach(([k, v]) => {
              merged[k] = merged[k] ? maxPerm(merged[k], v as PermissionLevel) : (v as PermissionLevel);
            });
          });
        }

        if (hasCustomRole) {
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
  }, [userId, rolesKey, authLoading]);

  const get = (key: ScreenKey | string): PermissionLevel => (perms[key] as PermissionLevel) || "none";
  const canView = (key: ScreenKey | string) => RANK[get(key)] >= RANK.view;
  const canEdit = (key: ScreenKey | string) => RANK[get(key)] >= RANK.edit;

  return { perms, loading, get, canView, canEdit };
}
