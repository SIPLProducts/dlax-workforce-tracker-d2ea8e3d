// Public endpoint. Generates a Supabase recovery link for a given email
// and emails it using the SMTP credentials stored in public.email_config.
// Always returns 200 to avoid user enumeration.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function htmlTemplate(opts: { recipient: string; link: string; appName: string }) {
  return `<!doctype html>
<html><body style="font-family:Inter,Arial,sans-serif;background:#f5f7fb;padding:32px;color:#0f172a;">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#0F1F47,#14306B);color:#fff;padding:20px 28px;">
      <h2 style="margin:0;font-size:18px;letter-spacing:.04em;">${opts.appName}</h2>
    </td></tr>
    <tr><td style="padding:28px;">
      <h3 style="margin:0 0 12px;font-size:20px;">Reset your password</h3>
      <p style="margin:0 0 16px;line-height:1.5;color:#334155;">
        Hi${opts.recipient ? " " + opts.recipient : ""}, we received a request to reset the password for your ${opts.appName} account.
        Click the button below to set a new password. This link expires in 1 hour.
      </p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${opts.link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">
          Reset password
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#64748b;">If the button doesn't work, copy and paste this link:</p>
      <p style="word-break:break-all;font-size:12px;color:#475569;">${opts.link}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#64748b;">If you didn't request this, you can safely ignore this email.</p>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const { email, redirectTo } = (await req.json()) as { email?: string; redirectTo?: string };
    const cleaned = (email || "").trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return ok();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Load config
    const { data: cfg } = await admin.from("email_config").select("*").eq("id", "default").maybeSingle();
    if (!cfg || !cfg.enabled || !cfg.smtp_host || !cfg.from_email || !cfg.app_password) {
      console.warn("Email config missing or disabled; skipping send for", cleaned);
      return ok();
    }

    // Generate recovery link
    const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: cleaned,
      options: { redirectTo: redirectTo || "https://dlax.siplproducts.com/reset-password" },
    });
    if (linkErr || !linkRes?.properties?.action_link) {
      console.warn("generateLink failed for", cleaned, linkErr?.message);
      return ok();
    }
    const actionLink = linkRes.properties.action_link;

    // Lookup display name
    let recipientName = "";
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("display_name")
        .eq("email", cleaned)
        .maybeSingle();
      recipientName = (prof?.display_name as string | null) || "";
    } catch { /* ignore */ }

    const html = htmlTemplate({
      recipient: recipientName,
      link: actionLink,
      appName: cfg.from_name || "DLAX",
    });

    const tlsImplicit = cfg.encryption === "ssl";
    const client = new SMTPClient({
      connection: {
        hostname: cfg.smtp_host,
        port: Number(cfg.smtp_port),
        tls: tlsImplicit,
        auth: { username: cfg.username, password: cfg.app_password },
      },
    });
    try {
      await client.send({
        from: cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email,
        to: [cleaned],
        cc: (cfg.cc_recipients as string[] | null)?.length ? cfg.cc_recipients : undefined,
        subject: "Reset your DLAX password",
        content: `Reset your password: ${actionLink}`,
        html,
      });
    } finally {
      await client.close().catch(() => {});
    }

    return ok();
  } catch (err) {
    console.error("send-password-reset error", err);
    return ok();
  }
});
