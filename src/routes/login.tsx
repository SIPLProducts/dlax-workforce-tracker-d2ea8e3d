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
    <div className="flex min-h-screen bg-muted/30">
      {/* Left Brand Panel */}
      <div
        className="relative hidden lg:flex lg:w-[45%] xl:w-[48%] flex-col justify-between overflow-hidden p-12 text-white"
        style={{
          background:
            "linear-gradient(135deg, #0A1530 0%, #0F1F47 55%, #14306B 100%)",
        }}
      >
        {/* Abstract connectivity line-art */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.55]"
          viewBox="0 0 600 800"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Edges */}
          <g stroke="white" strokeOpacity="0.10" strokeWidth="1">
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
          </g>
          {/* Glow halos */}
          <circle cx="260" cy="220" r="60" fill="url(#glow)" />
          <circle cx="380" cy="420" r="80" fill="url(#glow)" />
          <circle cx="460" cy="580" r="55" fill="url(#glow)" />
          {/* Nodes */}
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
            <circle cx="260" cy="220" r="2" />
            <circle cx="380" cy="420" r="2" />
            <circle cx="460" cy="580" r="2" />
          </g>
        </svg>

        {/* Top: logo */}
        <div className="relative z-10">
          <KpcLogo variant="on-dark" className="h-10 w-auto" />
        </div>

        {/* Centered brand block */}
        <div className="relative z-10 max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300/80">
            Enterprise Edition
          </p>
          <h1 className="mt-4 text-7xl font-bold tracking-tight leading-none">
            DLAX
          </h1>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300/90">
            Daily Labour Attendance &amp; Tracking
          </p>
          <p className="mt-6 text-base leading-relaxed text-slate-300/90 max-w-sm">
            Enterprise workforce management for KPC and partner contractor
            operations across all project sites.
          </p>
        </div>

        {/* Bottom: QR + footer */}
        <div className="relative z-10 space-y-5">
          <div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 backdrop-blur-sm max-w-sm">
            <div className="rounded-lg bg-white p-2 shrink-0">
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
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {/* Mobile brand band */}
        <div
          className="mb-8 flex w-full max-w-[440px] flex-col items-center gap-2 rounded-3xl px-6 py-6 text-white lg:hidden"
          style={{
            background:
              "linear-gradient(135deg, #0A1530 0%, #0F1F47 55%, #14306B 100%)",
          }}
        >
          <KpcLogo variant="on-dark" className="h-7 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight">DLAX</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/90">
            Daily Labour Attendance &amp; Tracking
          </p>
        </div>

        {/* Login card */}
        <div
          className="w-full max-w-[440px] rounded-2xl bg-card p-8 sm:p-10"
          style={{
            boxShadow:
              "0 30px 80px -20px rgba(15,31,71,0.18), 0 8px 24px -12px rgba(15,31,71,0.10)",
          }}
        >
          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Sign in to your DLAX account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="userId" className="text-xs font-medium text-muted-foreground">
                USER ID
              </Label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
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
                  className="h-12 pl-10 rounded-xl border-0 bg-muted/60 transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0"
                />
              </div>
              <p className="text-[11px] text-muted-foreground pl-1">
                Enter your User ID only — not your full email address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                PASSWORD
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="h-12 pl-10 pr-11 rounded-xl border-0 bg-muted/60 transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold text-sm tracking-wide shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30"
              disabled={loading}
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
            <p className="text-xs text-muted-foreground">
              Don't have an account? Please contact your administrator.
            </p>
          </div>
        </div>

        {/* Mobile QR install */}
        <div
          className="mt-6 flex w-full max-w-[440px] items-center gap-3 rounded-2xl bg-card p-3.5 lg:hidden"
          style={{
            boxShadow:
              "0 20px 50px -20px rgba(15,31,71,0.12), 0 4px 16px -8px rgba(15,31,71,0.08)",
          }}
        >
          <div className="rounded-lg bg-white p-1.5 border shrink-0">
            <QRCodeSVG value={INSTALL_URL} size={60} level="M" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-primary" />
              <p className="text-sm font-semibold">Install on Mobile</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Scan and tap "Add to Home Screen".
            </p>
          </div>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground lg:hidden">
          © 2026 Sharvi Infotech Pvt Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
