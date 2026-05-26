import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Smartphone, User, Lock } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { KpcLogo } from "@/components/KpcLogo";

const INSTALL_URL = "https://dlax.siplproducts.com";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signInWithUserId } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanedId = userId.includes("@") ? userId.split("@")[0] : userId;
      const { error } = await signInWithUserId(cleanedId, password);
      if (error) throw error;
      toast.success("Logged in successfully");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-full overflow-hidden"
      style={{
        background:
          "linear-gradient(105deg, #0B1A3A 0%, #1B2A4E 28%, #4B5A75 55%, #B9BFCC 78%, #F2EFEA 100%)",
      }}
    >
      {/* Mesh blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-70"
        style={{ background: "radial-gradient(circle at center, #1E2F66 0%, transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -left-24 h-[420px] w-[420px] rounded-full blur-3xl opacity-60"
        style={{ background: "radial-gradient(circle at center, #2E4368 0%, transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 h-[600px] w-[600px] rounded-full blur-3xl opacity-80"
        style={{ background: "radial-gradient(circle at center, #EEE8DC 0%, transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/4 right-1/4 h-[360px] w-[360px] rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle at center, #F5C56B 0%, transparent 70%)" }}
      />

      {/* Grain overlay */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04] mix-blend-overlay"
      >
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* Top-left brand mark (desktop only) */}
      <div className="absolute top-8 left-8 z-10 hidden lg:flex items-center gap-3 text-white">
        <KpcLogo variant="on-dark" className="h-9 w-auto" />
        <div className="h-8 w-px bg-white/25" />
        <div>
          <p className="text-lg font-bold tracking-tight leading-none">DLAX</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-white/70">
            Daily Labour Attendance
          </p>
        </div>
      </div>

      {/* Bottom-left footer (desktop) */}
      <p className="absolute bottom-6 left-8 z-10 hidden lg:block text-[11px] text-white/55">
        © 2026 Sharvi Infotech Pvt Ltd. All rights reserved.
      </p>

      {/* Bottom-right QR pill (desktop) */}
      <div className="absolute bottom-6 right-8 z-10 hidden lg:flex items-center gap-3 rounded-2xl bg-white/15 border border-white/25 px-3 py-2 backdrop-blur-xl shadow-lg">
        <div className="rounded-md bg-white p-1.5">
          <QRCodeSVG value={INSTALL_URL} size={48} level="M" />
        </div>
        <div className="min-w-0 pr-1">
          <div className="flex items-center gap-1.5 text-slate-900">
            <Smartphone className="h-3.5 w-3.5" />
            <p className="text-xs font-semibold">Install on Mobile</p>
          </div>
          <p className="text-[11px] text-slate-700/80 leading-snug">
            Scan to add to home screen
          </p>
        </div>
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10 lg:justify-end lg:pr-[10vw]">
        {/* Mobile brand */}
        <div className="mb-6 flex flex-col items-center gap-2 text-white lg:hidden">
          <KpcLogo variant="on-dark" className="h-8 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight">DLAX</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
            Daily Labour Attendance &amp; Tracking
          </p>
        </div>

        {/* Glass login card */}
        <div
          className="w-full max-w-[420px] rounded-3xl border border-white/40 bg-white/70 p-8 sm:p-9 backdrop-blur-2xl dark:border-white/15 dark:bg-white/10"
          style={{
            boxShadow:
              "0 30px 80px -20px rgba(11,26,58,0.35), 0 8px 24px -12px rgba(11,26,58,0.20)",
          }}
        >
          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Welcome back
            </h2>
            <p className="text-sm text-slate-600 dark:text-white/70 mt-1.5">
              Sign in to your DLAX account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="userId"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-white/70"
              >
                User ID
              </Label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 transition-colors group-focus-within:text-primary dark:text-white/60" />
                <Input
                  id="userId"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="e.g. bala"
                  className="h-12 pl-10 rounded-xl border-0 bg-white/60 text-slate-900 placeholder:text-slate-400 transition-all focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0 dark:bg-white/10 dark:text-white dark:placeholder:text-white/40 dark:focus-visible:bg-white/20"
                />
              </div>
              <p className="text-[11px] text-slate-600/80 dark:text-white/55 pl-1">
                Enter your User ID only — not your full email.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-white/70"
              >
                Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 transition-colors group-focus-within:text-primary dark:text-white/60" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="h-12 pl-10 pr-11 rounded-xl border-0 bg-white/60 text-slate-900 placeholder:text-slate-400 transition-all focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0 dark:bg-white/10 dark:text-white dark:placeholder:text-white/40 dark:focus-visible:bg-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors dark:text-white/60 dark:hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold text-sm tracking-wide text-white border-0 transition-all hover:brightness-110"
              style={{
                background:
                  "linear-gradient(135deg, #0F1F47 0%, #1B2F66 60%, #2A4488 100%)",
                boxShadow: "0 10px 30px -10px rgba(15,31,71,0.55)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-7 text-center">
            <p className="text-xs text-slate-600 dark:text-white/60">
              Don't have an account? Please contact your administrator.
            </p>
          </div>
        </div>

        {/* Mobile QR */}
        <div className="mt-6 flex w-full max-w-[420px] items-center gap-3 rounded-2xl border border-white/40 bg-white/60 p-3 backdrop-blur-xl lg:hidden">
          <div className="rounded-md bg-white p-1.5 shrink-0">
            <QRCodeSVG value={INSTALL_URL} size={56} level="M" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-slate-900">
              <Smartphone className="h-3.5 w-3.5" />
              <p className="text-sm font-semibold">Install on Mobile</p>
            </div>
            <p className="text-xs text-slate-700/80 mt-0.5 leading-snug">
              Scan and tap "Add to Home Screen".
            </p>
          </div>
        </div>

        <p className="mt-6 text-[11px] text-white/70 lg:hidden">
          © 2026 Sharvi Infotech Pvt Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
