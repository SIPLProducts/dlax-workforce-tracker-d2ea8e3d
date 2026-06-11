import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type PermissionLevel = "none" | "view" | "edit";

type SaveRoleInput = {
  id?: string | null;
  name: string;
  description?: string | null;
  permissions: Record<string, PermissionLevel>;
};

export const adminSaveRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveRoleInput) => {
    const name = (input.name || "").trim();
    if (!name) throw new Error("Role name is required");
    const permissions: Record<string, PermissionLevel> = {};
    for (const [k, v] of Object.entries(input.permissions || {})) {
      if (v === "none" || v === "view" || v === "edit") {
        permissions[k] = v;
      }
    }
    return {
      id: input.id ?? null,
      name,
      description: (input.description || "").trim() || null,
      permissions,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: system admin OR custom role with edit on user_management
    const [{ data: isAdmin, error: roleErr }, { data: canEdit, error: permErr }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_screen_edit", { _user_id: userId, _screen_key: "user_management" }),
    ]);
    if (roleErr || permErr) throw new Error("Failed to verify permissions");
    if (!isAdmin && !canEdit) throw new Error("Forbidden: requires User Management edit permission");

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Duplicate-name check (case-insensitive, excluding current id)
    const { data: dup } = await admin
      .from("custom_roles")
      .select("id")
      .ilike("name", data.name);
    const duplicate = (dup || []).find((r) => r.id !== data.id);
    if (duplicate) throw new Error(`A role named "${data.name}" already exists`);

    let roleId = data.id;
    if (roleId) {
      const { error } = await admin
        .from("custom_roles")
        .update({ name: data.name, description: data.description })
        .eq("id", roleId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await admin
        .from("custom_roles")
        .insert({ name: data.name, description: data.description })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      roleId = created.id;
    }

    // Replace permissions
    const { error: delErr } = await admin
      .from("role_screen_permissions")
      .delete()
      .eq("role_id", roleId!);
    if (delErr) throw new Error(delErr.message);

    const rows = Object.entries(data.permissions).map(([screen_key, permission]) => ({
      role_id: roleId!,
      screen_key,
      permission,
    }));

    if (rows.length > 0) {
      const { error: insErr } = await admin.from("role_screen_permissions").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { id: roleId! };
  });
