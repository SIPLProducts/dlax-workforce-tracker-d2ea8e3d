import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  smtp?: {
    host: string;
    port: number;
    encryption: "none" | "ssl" | "tls";
    username: string;
    password: string;
    from_email: string;
    from_name?: string;
  };
};

function validate(input: unknown): SendEmailInput {
  const v = input as SendEmailInput;
  if (!v || typeof v !== "object") throw new Error("Invalid payload");
  if (!v.to || !v.subject || !v.html) throw new Error("Missing to/subject/html");
  return v;
}

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admin only
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin only");

    // Resolve SMTP settings
    let smtp = data.smtp;
    let ccFromConfig: string[] = [];

    if (!smtp) {
      const { data: cfg, error: cfgErr } = await supabase
        .from("email_config")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      if (cfgErr) throw new Error(cfgErr.message);
      if (!cfg) throw new Error("Email configuration is not set");
      if (!cfg.smtp_host || !cfg.from_email || !cfg.app_password) {
        throw new Error("Email configuration is incomplete");
      }
      smtp = {
        host: cfg.smtp_host,
        port: cfg.smtp_port ?? 587,
        encryption: (cfg.encryption ?? "tls") as "none" | "ssl" | "tls",
        username: cfg.username ?? cfg.from_email,
        password: cfg.app_password,
        from_email: cfg.from_email,
        from_name: cfg.from_name ?? undefined,
      };
      ccFromConfig = (cfg.cc_recipients as string[] | null) ?? [];
    }

    const cc = [...(data.cc ?? []), ...ccFromConfig];
    const toList = Array.isArray(data.to) ? data.to : [data.to];

    // Dynamic import keeps nodemailer out of the client bundle
    const nodemailer = (await import("nodemailer")).default;

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port),
      secure: smtp.encryption === "ssl", // true for 465/SSL; STARTTLS auto-negotiated otherwise
      requireTLS: smtp.encryption === "tls",
      auth: { user: smtp.username, pass: smtp.password },
    });

    try {
      const info = await transporter.sendMail({
        from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
        to: toList,
        cc: cc.length ? cc : undefined,
        subject: data.subject,
        html: data.html,
        text: data.text,
      });
      return { ok: true as const, messageId: info.messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SMTP send failed";
      throw new Error(msg);
    }
  });
