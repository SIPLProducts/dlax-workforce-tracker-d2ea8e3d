// Sends an email using the SMTP credentials stored in public.email_config.
// Admin-only: caller must be authenticated and have the 'admin' app_role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  // Optional override for live-form test sends (admin only)
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

async function loadConfig(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("email_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error("Failed to load email config");
  if (!data) throw new Error("Email configuration is not set");
  if (!data.smtp_host || !data.from_email || !data.app_password) {
    throw new Error("Email configuration is incomplete");
  }
  return data;
}

async function sendWithSmtp(opts: {
  host: string; port: number; encryption: "none" | "ssl" | "tls";
  username: string; password: string;
  from: string; fromName?: string;
  to: string[]; cc?: string[]; subject: string; html: string; text?: string;
}) {
  const tlsImplicit = opts.encryption === "ssl";
  const useStartTls = opts.encryption === "tls";
  const client = new SMTPClient({
    connection: {
      hostname: opts.host,
      port: opts.port,
      tls: tlsImplicit,
      auth: { username: opts.username, password: opts.password },
    },
  });
  try {
    await client.send({
      from: opts.fromName ? `${opts.fromName} <${opts.from}>` : opts.from,
      to: opts.to,
      cc: opts.cc && opts.cc.length ? opts.cc : undefined,
      subject: opts.subject,
      content: opts.text ?? "This email requires an HTML-capable client.",
      html: opts.html,
    });
  } finally {
    await client.close().catch(() => {});
  }
  void useStartTls; // denomailer auto-negotiates STARTTLS for non-implicit TLS ports
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Verify the caller is an admin
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: roleOk } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!roleOk) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const body = (await req.json()) as Body;
    if (!body?.to || !body?.subject || !body?.html) {
      return new Response(JSON.stringify({ error: "Missing to/subject/html" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const toList = Array.isArray(body.to) ? body.to : [body.to];

    let smtp: NonNullable<Body["smtp"]>;
    if (body.smtp) {
      smtp = body.smtp;
    } else {
      const cfg = await loadConfig(admin);
      smtp = {
        host: cfg.smtp_host,
        port: cfg.smtp_port,
        encryption: cfg.encryption as any,
        username: cfg.username,
        password: cfg.app_password,
        from_email: cfg.from_email,
        from_name: cfg.from_name,
      };
    }

    // Merge cc from config when not overriding
    let cc = body.cc;
    if (!body.smtp) {
      const { data: cfg } = await admin.from("email_config").select("cc_recipients").eq("id", "default").maybeSingle();
      cc = [...(cc ?? []), ...((cfg?.cc_recipients as string[] | null) ?? [])];
    }

    await sendWithSmtp({
      host: smtp.host,
      port: Number(smtp.port),
      encryption: smtp.encryption,
      username: smtp.username,
      password: smtp.password,
      from: smtp.from_email,
      fromName: smtp.from_name,
      to: toList,
      cc,
      subject: body.subject,
      html: body.html,
      text: body.text,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("send-email error", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Send failed" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
