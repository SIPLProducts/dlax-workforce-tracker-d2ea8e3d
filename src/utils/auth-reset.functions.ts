import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type ResetInput = { loginId: string; newPassword: string };

export const resetPasswordByUserId = createServerFn({ method: "POST" })
  .inputValidator((input: ResetInput) => {
    const loginId = (input.loginId || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,40}$/.test(loginId)) {
      throw new Error("Invalid User ID");
    }
    if (!input.newPassword || input.newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    if (input.newPassword.length > 72) {
      throw new Error("Password must be at most 72 characters");
    }
    return { loginId, newPassword: input.newPassword };
  })
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: lookupErr } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("login_id", data.loginId)
      .maybeSingle();
    if (lookupErr) throw new Error("Lookup failed");
    if (!profile?.user_id) throw new Error("User ID not found");

    const { error } = await admin.auth.admin.updateUserById(profile.user_id, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message || "Failed to update password");

    return { ok: true };
  });
