import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type CreateUserInput = {
  loginId: string;
  password: string;
  displayName: string;
};

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

    // Verify caller is admin
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error("Failed to verify admin role");
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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

    if (error) {
      // Surface friendly message for duplicates
      const msg = error.message || "Failed to create user";
      if (/already|exists|registered/i.test(msg)) {
        throw new Error(`User ID "${data.loginId}" already exists`);
      }
      throw new Error(msg);
    }

    return { userId: created.user?.id, loginId: data.loginId };
  });
