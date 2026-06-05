import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Smartphone, User, Lock, ArrowRight } from "lucide-react";
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

  // Purge any stale Supabase session on landing here. If a previous deploy
  // signed the JWT with a different JWT_SECRET, the stored token will fail
  // every PostgREST call with PGRST301 / JWSInvalidSignature. Clearing it
  // before sign-in guarantees the next login uses a freshly issued token.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
      } catch {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
    })();
  }, []);

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
    <div className="relative flex min-h-screen overflow-hidden bg-slate-50 text-white">
      {/* Local keyframes for slow gradient drift */}
      <style>{`
        @keyframes meshDrift {
          0%   { transform: translate3d(0,0,0) scale(1); }
          50%  { transform: translate3d(4%, -3%, 0) scale(1.08); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
        @keyframes meshDrift2 {
          0%   { transform: translate3d(0,0,0) scale(1); }
          50%  { transform: translate3d(-5%, 4%, 0) scale(1.12); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
        @keyframes sparkPulse {
          0%, 100% { opacity: 0.55; transform: scaleX(1); }
          50%      { opacity: 1;    transform: scaleX(1.15); }
        }
      `}</style>

      {/* (Background mesh moved into the right login panel only) */}

      {/* Left Brand Panel */}
      <div
        className="relative hidden lg:flex lg:w-[55%] flex-col justify-between overflow-hidden p-12"
        style={{
          background:
            "linear-gradient(135deg, #0A1530 0%, #0F1F47 55%, #14306B 100%)",
        }}
      >
        {/* Constellation line-art */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.55]"
          viewBox="0 0 600 800"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="glowIndigo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#818CF8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g stroke="white" strokeOpacity="0.12" strokeWidth="1">
            <line x1="80" y1="120" x2="260" y2="220" />
            <line x1="260" y1="220" x2="460" y2="140" />
            <line x1="460" y1="140" x2="540" y2="300" />
            <line x1="540" y1="300" x2="380" y2="420" />
            <line x1="380" y1="420" x2="180" y2="380" />
            <line x1="180" y1="380" x2="80" y2="540" />
            <line x1="80" y1="540" x2="240" y2="620" />
            <line x1="240" y1="620" x2="460" y2="580" />
            <line x1="460" y1="580" x2="520" y2="720" />
            <line x1="260" y1="220" x2="180" y2="380" />
            <line x1="380" y1="420" x2="460" y2="580" />
            <line x1="80" y1="120" x2="180" y2="380" />
            <line x1="240" y1="620" x2="380" y2="420" />
            <line x1="460" y1="140" x2="380" y2="420" />
            <line x1="540" y1="300" x2="460" y2="580" />
          </g>
          <circle cx="260" cy="220" r="70" fill="url(#glowIndigo)" />
          <circle cx="380" cy="420" r="100" fill="url(#glow)" />
          <circle cx="460" cy="580" r="65" fill="url(#glowIndigo)" />
          <g fill="white">
            <circle cx="80" cy="120" r="2" fillOpacity="0.6" />
            <circle cx="260" cy="220" r="3.5" />
            <circle cx="460" cy="140" r="2" fillOpacity="0.6" />
            <circle cx="540" cy="300" r="2" fillOpacity="0.5" />
            <circle cx="380" cy="420" r="4" />
            <circle cx="180" cy="380" r="2.5" fillOpacity="0.7" />
            <circle cx="80" cy="540" r="2" fillOpacity="0.5" />
            <circle cx="240" cy="620" r="2.5" fillOpacity="0.7" />
            <circle cx="460" cy="580" r="3.5" />
            <circle cx="520" cy="720" r="2" fillOpacity="0.5" />
          </g>
          <g fill="#FBBF24">
            <circle cx="260" cy="220" r="2.5">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="380" cy="420" r="2.5">
              <animate attributeName="opacity" values="1;0.4;1" dur="3.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="460" cy="580" r="2.5">
              <animate attributeName="opacity" values="0.6;1;0.6" dur="4s" repeatCount="indefinite" />
            </circle>
          </g>
        </svg>

        {/* Top: logo */}
        <div className="relative z-10 flex items-center gap-3">
          <KpcLogo variant="on-dark" className="h-10 w-auto" />
          <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300/70">
            Enterprise Edition
          </span>
        </div>

        {/* Centered brand block */}
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-indigo-200/90 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34D399]" />
            System Online
          </div>
          <h1 className="mt-6 bg-gradient-to-br from-white via-white to-indigo-200 bg-clip-text text-[110px] font-bold leading-[0.95] tracking-tight text-transparent">
            DLAX
          </h1>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.32em] text-amber-300/90">
            Daily Labour Attendance &amp; Tracking
          </p>
          <p className="mt-6 max-w-md text-base leading-relaxed text-slate-300/80">
            Enterprise workforce management for KPC and partner contractor
            operations across every project site.
          </p>
        </div>

        {/* Bottom: QR + footer */}
        <div className="relative z-10 space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md max-w-sm shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]">
            <div className="rounded-xl bg-white p-2 shrink-0 shadow-md">
              <QRCodeSVG value={INSTALL_URL} size={72} level="M" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-amber-300" />
                <p className="font-semibold text-sm text-white">
                  Install on Mobile
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Scan with your phone camera, then tap "Add to Home Screen".
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            © 2026 Sharvi Infotech Pvt Ltd. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Login Panel */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-10"
        style={{
          background:
            "linear-gradient(135deg, #14306B 0%, #0F1F47 55%, #0A1530 100%)",
        }}
      >
        {/* Animated midnight mesh — only behind the login form */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-40 -left-40 h-[60vmax] w-[60vmax] rounded-full opacity-35 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, #4F46E5 0%, rgba(79,70,229,0) 70%)",
              animation: "meshDrift 18s ease-in-out infinite",
            }}
          />
          <div
            className="absolute top-1/3 -right-40 h-[55vmax] w-[55vmax] rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, #7C3AED 0%, rgba(124,58,237,0) 70%)",
              animation: "meshDrift2 22s ease-in-out infinite",
            }}
          />
          <div
            className="absolute -bottom-40 left-1/4 h-[45vmax] w-[45vmax] rounded-full opacity-20 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, #FBBF24 0%, rgba(251,191,36,0) 70%)",
              animation: "meshDrift 26s ease-in-out infinite",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"

            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse at center, black 40%, transparent 75%)",
            }}
          />
        </div>

        <div className="relative z-10 flex w-full flex-col items-center">
        {/* Mobile brand */}
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          <KpcLogo variant="on-dark" className="h-8 w-auto" />
          <h1 className="bg-gradient-to-br from-white to-indigo-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            DLAX
          </h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/90">
            Daily Labour Attendance &amp; Tracking
          </p>
        </div>

        {/* Glass login card */}
        <div
          className="relative w-full max-w-[440px] rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 animate-fade-in"
          style={{
            boxShadow:
              "0 40px 100px -20px rgba(0,0,0,0.45), 0 8px 32px -8px rgba(79,70,229,0.25)",
          }}
        >
          {/* subtle top edge highlight */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h2>
            <div
              className="mt-2 h-px w-12 origin-left bg-gradient-to-r from-indigo-500 to-transparent"
              style={{ animation: "sparkPulse 2.5s ease-in-out infinite" }}
            />
            <p className="text-sm text-slate-600 mt-3">
              Sign in to your DLAX account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="userId" className="text-[11px] font-semibold tracking-[0.18em] text-slate-700">
                USER ID
              </Label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 transition-colors group-focus-within:text-indigo-600" />
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
                  className="h-12 pl-10 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 shadow-none transition-all hover:bg-white focus-visible:bg-white focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400/40 focus-visible:ring-offset-0"
                />
              </div>
              <p className="text-[11px] text-slate-500 pl-1">
                Enter your User ID only — not your full email address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[11px] font-semibold tracking-[0.18em] text-slate-700">
                PASSWORD
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 transition-colors group-focus-within:text-indigo-600" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="h-12 pl-10 pr-11 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 shadow-none transition-all hover:bg-white focus-visible:bg-white focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400/40 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="group relative w-full h-12 rounded-xl font-semibold text-sm tracking-wide text-white border-0 bg-gradient-to-r from-indigo-500 via-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 shadow-[0_10px_30px_-8px_rgba(99,102,241,0.6)] hover:shadow-[0_14px_36px_-8px_rgba(99,102,241,0.75)] transition-all hover:-translate-y-0.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-7 text-center">
            <p className="text-xs text-slate-600">
              Don't have an account?{" "}
              <span className="text-indigo-600 font-medium">Contact your administrator.</span>
            </p>
          </div>
        </div>

        {/* Mobile QR install */}
        <div className="mt-6 flex w-full max-w-[440px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md lg:hidden">
          <div className="rounded-lg bg-white p-1.5 shrink-0">
            <QRCodeSVG value={INSTALL_URL} size={60} level="M" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-amber-300" />
              <p className="text-sm font-semibold text-white">Install on Mobile</p>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">
              Scan and tap "Add to Home Screen".
            </p>
          </div>
        </div>

          <p className="mt-6 text-[11px] text-slate-500 lg:hidden">
            © 2026 Sharvi Infotech Pvt Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
