import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomInt } from "crypto";
import type { Database } from "@/integrations/supabase/types";

function adminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findUserByEmail(admin: ReturnType<typeof adminClient>, email: string) {
  // 1) Try profiles.contact_email
  const { data: byContact } = await admin
    .from("profiles")
    .select("user_id, contact_email, email, display_name")
    .ilike("contact_email", email)
    .maybeSingle();
  if (byContact?.user_id) {
    return { userId: byContact.user_id as string, name: (byContact.display_name as string | null) || "" };
  }
  // 2) Fall back to profiles.email
  const { data: byProfileEmail } = await admin
    .from("profiles")
    .select("user_id, email, display_name")
    .ilike("email", email)
    .maybeSingle();
  if (byProfileEmail?.user_id) {
    return { userId: byProfileEmail.user_id as string, name: (byProfileEmail.display_name as string | null) || "" };
  }
  return null;
}

async function sendOtpEmail(opts: {
  to: string;
  otp: string;
  name: string;
}) {
  const admin = adminClient();
  const { data: cfg, error } = await admin
    .from("email_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cfg || !cfg.enabled) throw new Error("Email is not configured. Please contact your administrator.");
  if (!cfg.smtp_host || !cfg.from_email || !cfg.app_password) {
    throw new Error("Email configuration is incomplete. Please contact your administrator.");
  }

  const html = `<!doctype html>
<html><body style="font-family:Inter,Arial,sans-serif;background:#f5f7fb;padding:32px;color:#0f172a;">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#0F1F47,#14306B);color:#fff;padding:18px 24px;">
      <h2 style="margin:0;font-size:16px;letter-spacing:.04em;">${cfg.from_name || "DLAX"}</h2>
    </td></tr>
    <tr><td style="padding:28px;">
      <h3 style="margin:0 0 10px;font-size:18px;">Your password reset code</h3>
      <p style="margin:0 0 18px;line-height:1.5;color:#334155;">
        Hi${opts.name ? " " + opts.name : ""}, use the code below to reset your password. It expires in 10 minutes.
      </p>
      <p style="text-align:center;margin:22px 0;">
        <span style="display:inline-block;font-size:30px;letter-spacing:10px;font-weight:700;color:#0F1F47;background:#EEF2FF;border:1px solid #C7D2FE;padding:14px 22px;border-radius:12px;">
          ${opts.otp}
        </span>
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;">If you didn't request this, you can safely ignore this email.</p>
    </td></tr>
  </table>
</body></html>`;

  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: Number(cfg.smtp_port ?? 587),
    secure: cfg.encryption === "ssl",
    requireTLS: cfg.encryption === "tls",
    auth: { user: cfg.username ?? cfg.from_email, pass: cfg.app_password },
  });

  await transporter.sendMail({
    from: cfg.from_name ? `"${cfg.from_name}" <${cfg.from_email}>` : cfg.from_email,
    to: opts.to,
    subject: `Your ${cfg.from_name || "DLAX"} password reset code`,
    html,
    text: `Your password reset code is ${opts.otp}. It expires in 10 minutes.`,
  });
}

export const requestPasswordOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    const email = (input?.email || "").trim().toLowerCase();
    if (!email || !EMAIL_RX.test(email)) throw new Error("Please enter a valid email address");
    return { email };
  })
  .handler(async ({ data }) => {
    const admin = adminClient();

    const found = await findUserByEmail(admin, data.email);
    if (!found) return { ok: false as const, error: "No account found with this email" };

    // 60s rate limit on resends
    const { data: recent } = await admin
      .from("password_reset_otps")
      .select("created_at")
      .eq("email", data.email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at) {
      const ageSec = (Date.now() - new Date(recent.created_at as string).getTime()) / 1000;
      if (ageSec < 60) {
        return { ok: false as const, error: `Please wait ${Math.ceil(60 - ageSec)}s before requesting another code` };
      }
    }

    // Invalidate prior unconsumed OTPs
    await admin
      .from("password_reset_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", data.email)
      .is("consumed_at", null);

    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insErr } = await admin.from("password_reset_otps").insert({
      user_id: found.userId,
      email: data.email,
      otp_hash: sha256(otp),
      expires_at: expiresAt,
    });
    if (insErr) return { ok: false as const, error: insErr.message };

    try {
      await sendOtpEmail({ to: data.email, otp, name: found.name });
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Failed to send email" };
    }

    return { ok: true as const };
  });

export const verifyPasswordOtpAndReset = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; otp: string; newPassword: string }) => {
    const email = (input?.email || "").trim().toLowerCase();
    const otp = (input?.otp || "").trim();
    const newPassword = input?.newPassword || "";
    if (!email || !EMAIL_RX.test(email)) throw new Error("Invalid email");
    if (!/^\d{6}$/.test(otp)) throw new Error("Enter the 6-digit code");
    if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
    if (newPassword.length > 72) throw new Error("Password must be at most 72 characters");
    return { email, otp, newPassword };
  })
  .handler(async ({ data }) => {
    const admin = adminClient();

    const { data: row, error } = await admin
      .from("password_reset_otps")
      .select("id, user_id, otp_hash, expires_at, attempts, consumed_at")
      .eq("email", data.email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!row) return { ok: false as const, error: "Invalid or expired code" };
    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      return { ok: false as const, error: "Code has expired. Request a new one." };
    }
    if ((row.attempts as number) >= 5) {
      return { ok: false as const, error: "Too many attempts. Request a new code." };
    }

    if (sha256(data.otp) !== row.otp_hash) {
      await admin
        .from("password_reset_otps")
        .update({ attempts: (row.attempts as number) + 1 })
        .eq("id", row.id as string);
      return { ok: false as const, error: "Invalid or expired code" };
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id as string, {
      password: data.newPassword,
    });
    if (updErr) return { ok: false as const, error: updErr.message || "Failed to update password" };

    await admin
      .from("password_reset_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id as string);

    return { ok: true as const };
  });
