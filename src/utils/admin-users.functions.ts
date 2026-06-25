import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type CreateUserInput = {
  loginId: string;
  password: string;
  displayName: string;
  contactEmail: string;
  mobileNo?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[+0-9][0-9\s\-]{6,19}$/;

function normalizeEmail(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) throw new Error("Email is required");
  if (v.length > 255 || !EMAIL_RE.test(v)) throw new Error("Invalid email address");
  return v;
}

function normalizeMobile(raw: unknown): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (v.length > 20 || !MOBILE_RE.test(v)) {
    throw new Error("Invalid mobile number (7-20 chars; digits, +, -, space)");
  }
  return v;
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateUserInput) => {
    const loginId = (input.loginId || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,40}$/.test(loginId)) {
      throw new Error("User ID must be 2-40 chars: letters, numbers, . _ -");
    }
    if (!input.password || input.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    return {
      loginId,
      password: input.password,
      displayName: (input.displayName || "").trim(),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Allow system admin OR custom role with edit on user_management
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

    // Pre-check: login_id must be unique
    const { data: existing } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("login_id", data.loginId)
      .maybeSingle();
    if (existing) {
      throw new Error(`User ID "${data.loginId}" already exists`);
    }

    const email = `${data.loginId}@dlax.local`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        login_id: data.loginId,
        display_name: data.displayName,
      },
    });

    if (error || !created?.user) {
      const msg = error?.message || "Failed to create user";
      if (/already|exists|registered|duplicate/i.test(msg)) {
        throw new Error(`User ID "${data.loginId}" already exists`);
      }
      throw new Error(msg);
    }

    const newUserId = created.user.id;

    // Ensure profile exists (the auth trigger should create it, but we make
    // it deterministic here so the UI can refresh immediately).
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: newUserId,
          email,
          login_id: data.loginId,
          display_name: data.displayName || null,
        },
        { onConflict: "user_id" },
      );

    if (upsertErr) {
      console.error("[adminCreateUser] profile upsert failed:", upsertErr);
      throw new Error(
        `Account created but profile save failed: ${upsertErr.message}`,
      );
    }

    return {
      userId: newUserId,
      loginId: data.loginId,
      email,
      displayName: data.displayName || null,
    };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input.userId || typeof input.userId !== "string") {
      throw new Error("userId is required");
    }
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.userId === userId) {
      throw new Error("You cannot delete your own account");
    }

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

    // Last-admin guard
    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const targetIsAdmin = (targetRoles || []).some((r: any) => r.role === "admin");
    if (targetIsAdmin) {
      const { count } = await admin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count || 0) <= 1) {
        throw new Error("Cannot delete the last remaining admin");
      }
    }

    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message || "Failed to delete user");

    return { userId: data.userId };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; displayName?: string; password?: string; loginId?: string }) => {
    if (!input.userId || typeof input.userId !== "string") {
      throw new Error("userId is required");
    }
    const displayName = input.displayName !== undefined ? String(input.displayName).trim() : undefined;
    const password = input.password !== undefined && input.password !== "" ? String(input.password) : undefined;
    let loginId: string | undefined;
    if (input.loginId !== undefined) {
      loginId = String(input.loginId).trim().toLowerCase();
      if (!/^[a-z0-9._-]{2,40}$/.test(loginId)) {
        throw new Error("User ID must be 2-40 chars: letters, numbers, . _ -");
      }
    }
    if (displayName === undefined && password === undefined && loginId === undefined) {
      throw new Error("Provide a value to update");
    }
    if (password !== undefined && password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    return { userId: input.userId, displayName, password, loginId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

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

    let newEmail: string | undefined;
    if (data.loginId !== undefined) {
      const { data: currentProfile } = await admin
        .from("profiles")
        .select("login_id")
        .eq("user_id", data.userId)
        .maybeSingle();
      const currentLogin = (currentProfile?.login_id || "").toLowerCase();
      if (currentLogin !== data.loginId) {
        const { data: existing } = await admin
          .from("profiles")
          .select("user_id")
          .ilike("login_id", data.loginId)
          .neq("user_id", data.userId)
          .maybeSingle();
        if (existing) {
          throw new Error(`User ID "${data.loginId}" already exists`);
        }
        newEmail = `${data.loginId}@dlax.local`;
      }
    }

    const authUpdate: { password?: string; email?: string; user_metadata?: Record<string, unknown> } = {};
    if (data.password) authUpdate.password = data.password;
    if (newEmail) authUpdate.email = newEmail;
    if (data.displayName !== undefined || newEmail) {
      const meta: Record<string, unknown> = {};
      if (data.displayName !== undefined) meta.display_name = data.displayName || null;
      if (newEmail && data.loginId) meta.login_id = data.loginId;
      authUpdate.user_metadata = meta;
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(data.userId, authUpdate);
      if (error) {
        const msg = error.message || "Failed to update user";
        if (newEmail && /already|exists|registered|duplicate/i.test(msg)) {
          throw new Error(`User ID "${data.loginId}" already exists`);
        }
        throw new Error(msg);
      }
    }

    const profileUpdate: { display_name?: string | null; login_id?: string; email?: string } = {};
    if (data.displayName !== undefined) profileUpdate.display_name = data.displayName || null;
    if (newEmail && data.loginId) {
      profileUpdate.login_id = data.loginId;
      profileUpdate.email = newEmail;
    }
    if (Object.keys(profileUpdate).length > 0) {
      const { error: profErr } = await admin
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", data.userId);
      if (profErr) throw new Error(profErr.message || "Failed to update profile");
    }

    return { userId: data.userId, displayName: data.displayName ?? null, loginId: data.loginId ?? null };
  });
