import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendEmail } from "@/lib/email.functions";
import { ScreenGuard } from "@/components/ScreenGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Save, Eye, EyeOff, X, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/email-config")({
  component: () => (
    <ScreenGuard screen="user_management">
      <EmailConfigPage />
    </ScreenGuard>
  ),
});

type Encryption = "none" | "ssl" | "tls";

interface Form {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  encryption: Encryption;
  username: string;
  app_password: string;
  from_email: string;
  from_name: string;
  cc_recipients: string[];
}

const DEFAULTS: Form = {
  enabled: false,
  smtp_host: "",
  smtp_port: 587,
  encryption: "tls",
  username: "",
  app_password: "",
  from_email: "",
  from_name: "",
  cc_recipients: [],
};

function EmailConfigPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [hasPassword, setHasPassword] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [ccInput, setCcInput] = useState("");
  const [testTo, setTestTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const sendEmailFn = useServerFn(sendEmail);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: dataRaw, error } = await (supabase as any)
        .from("email_config_public")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      const data = dataRaw as any;
      if (cancelled) return;
      if (error) {
        toast.error("Failed to load configuration");
      } else if (data) {
        setForm({
          enabled: !!data.enabled,
          smtp_host: data.smtp_host || "",
          smtp_port: data.smtp_port || 587,
          encryption: (data.encryption as Encryption) || "tls",
          username: data.username || "",
          app_password: "",
          from_email: data.from_email || "",
          from_name: data.from_name || "",
          cc_recipients: (data.cc_recipients as string[]) || [],
        });
        setHasPassword(!!data.has_password);
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes?.user?.email) setTestTo(userRes.user.email);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addCc = (raw: string) => {
    const parts = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const valid = parts.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (valid.length === 0) return;
    setForm((f) => ({
      ...f,
      cc_recipients: Array.from(new Set([...f.cc_recipients, ...valid])),
    }));
    setCcInput("");
  };

  const onCcKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCc(ccInput);
    } else if (e.key === "Backspace" && !ccInput && form.cc_recipients.length) {
      setForm((f) => ({ ...f, cc_recipients: f.cc_recipients.slice(0, -1) }));
    }
  };

  const handleSave = async () => {
    if (form.enabled && (!form.smtp_host || !form.from_email || !form.username)) {
      toast.error("Host, username and From Email are required when enabled");
      return;
    }
    if (form.enabled && !hasPassword && !form.app_password) {
      toast.error("App password is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        id: "default",
        enabled: form.enabled,
        smtp_host: form.smtp_host.trim(),
        smtp_port: Number(form.smtp_port) || 587,
        encryption: form.encryption,
        username: form.username.trim(),
        from_email: form.from_email.trim(),
        from_name: form.from_name.trim(),
        cc_recipients: form.cc_recipients,
      };
      if (form.app_password) payload.app_password = form.app_password;
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes?.user?.id) payload.updated_by = userRes.user.id;

      const { error } = await supabase.from("email_config").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      toast.success("Email configuration saved");
      if (form.app_password) {
        setHasPassword(true);
        setForm((f) => ({ ...f, app_password: "" }));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
      toast.error("Enter a valid test recipient email");
      return;
    }
    setTesting(true);
    try {
      // Use current form values when password was just typed; otherwise use saved config.
      const usingOverride = !!form.app_password;
      const body: any = {
        to: testTo,
        subject: "DLAX SMTP test email",
        html: `<p>This is a test email sent from your DLAX Email Configuration screen.</p><p>If you can read this, SMTP is working.</p>`,
      };
      if (usingOverride) {
        body.smtp = {
          host: form.smtp_host,
          port: Number(form.smtp_port) || 587,
          encryption: form.encryption,
          username: form.username,
          password: form.app_password,
          from_email: form.from_email,
          from_name: form.from_name,
        };
      }
      await sendEmailFn({ data: body });
      toast.success(`Test email sent to ${testTo}`);
    } catch (err: any) {
      toast.error(err?.message || "Test send failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Mail className="h-6 w-6 text-primary" />}
        title="Email Configuration"
        subtitle="Manage SMTP credentials for outbound emails (host, port, sender, app password). Used by Forgot Password and other system notifications."
      />

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
            <div>
              <p className="font-semibold">Enable No-Reply Sending</p>
              <p className="text-xs text-muted-foreground">When off, password reset emails and system notifications are not sent.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => update("enabled", v)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input value={form.smtp_host} onChange={(e) => update("smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                type="number"
                value={form.smtp_port}
                onChange={(e) => update("smtp_port", Number(e.target.value) || 0)}
                placeholder="587"
              />
            </div>
            <div className="space-y-2">
              <Label>Encryption</Label>
              <Select value={form.encryption} onValueChange={(v) => update("encryption", v as Encryption)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls">TLS / STARTTLS (587)</SelectItem>
                  <SelectItem value="ssl">SSL (465)</SelectItem>
                  <SelectItem value="none">None (not recommended)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="user@yourdomain.com" />
            </div>
            <div className="space-y-2">
              <Label>
                App Password{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {hasPassword ? "(leave empty to keep existing)" : "(required)"}
                </span>
              </Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={form.app_password}
                  onChange={(e) => update("app_password", e.target.value)}
                  placeholder={hasPassword ? "••••••••" : "Enter app password"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input value={form.from_email} onChange={(e) => update("from_email", e.target.value)} placeholder="noreply@yourdomain.com" />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input value={form.from_name} onChange={(e) => update("from_name", e.target.value)} placeholder="DLAX — No Reply" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>CC Recipients (optional)</Label>
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 min-h-11">
                {form.cc_recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, cc_recipients: f.cc_recipients.filter((e) => e !== email) }))}
                      className="ml-1 rounded-sm opacity-60 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  type="text"
                  className="flex-1 min-w-[160px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={onCcKey}
                  onBlur={() => ccInput && addCc(ccInput)}
                  placeholder="Add another..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Press Enter or comma to add. Every valid address here is CC'd on outbound notifications.
              </p>
            </div>
          </div>

          <div className="rounded-md border-l-4 border-primary bg-primary/5 p-3 text-sm text-muted-foreground">
            This account is the <strong>From</strong> address for system emails such as password reset. The recipient is on To; the
            addresses above are added as CC.
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">Using Gmail?</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>Host <code className="rounded bg-background px-1">smtp.gmail.com</code> · Port <code className="rounded bg-background px-1">587</code> · Encryption <strong>TLS / STARTTLS</strong></li>
                  <li>Username = your full Gmail address (e.g. <code className="rounded bg-background px-1">name@gmail.com</code>)</li>
                  <li>Password = a 16-character <strong>App Password</strong>, not your Google account password</li>
                  <li>
                    Generate one at{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      myaccount.google.com/apppasswords
                    </a>{" "}
                    — 2-Step Verification must be ON.
                  </li>
                </ul>
              </div>
            </div>
          </div>


          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2 sm:max-w-xs sm:flex-1">
              <Label>Send test to</Label>
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Test Email
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Configuration
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
