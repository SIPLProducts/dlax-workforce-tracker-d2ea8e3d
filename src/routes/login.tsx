import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { HardHat, Eye, EyeOff, Users, Building2, ShieldCheck, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) throw error;
        toast.success("Account created! Check email for verification.");
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Logged in successfully");
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Users, label: "Workforce Tracking", desc: "Monitor 500+ daily workers" },
    { icon: Building2, label: "Multi-Project", desc: "Manage multiple sites" },
    { icon: BarChart3, label: "Real-time Reports", desc: "Instant manpower analytics" },
    { icon: ShieldCheck, label: "Role-Based Access", desc: "Admin, Supervisor, Manager" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-500/30">
              <HardHat className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">DLAX</h1>
              <p className="text-sm text-slate-400 font-medium">by KPC Infrastructure</p>
            </div>
          </div>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-sm">
            Daily Labour Attendance & Tracking System for enterprise workforce management.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {features.map((f) => (
            <div key={f.label} className="flex items-start gap-4 rounded-lg bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                <f.icon className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-white">{f.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-slate-500">© 2026 KPC Infrastructure. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-10">
        {/* Mobile header */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-500/20 mb-3">
            <HardHat className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">DLAX</h1>
          <p className="text-sm text-muted-foreground">Daily Labour Attendance & Tracking</p>
        </div>

        <Card className="w-full max-w-[420px] border-0 shadow-xl shadow-black/5 bg-card">
          <CardContent className="p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">
                {isSignUp ? "Create your account" : "Welcome back"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isSignUp ? "Enter your details to get started" : "Sign in to your DLAX account"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@kpc-infra.com"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  {!isSignUp && (
                    <button type="button" className="text-xs text-primary hover:underline font-medium">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Please wait...
                  </>
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  className="text-primary font-semibold hover:underline"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground lg:hidden">
          © 2026 KPC Infrastructure. All rights reserved.
        </p>
      </div>
    </div>
  );
}
