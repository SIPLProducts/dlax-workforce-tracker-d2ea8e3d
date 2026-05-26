import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { KpcLogo } from "@/components/KpcLogo";

const INSTALL_URL = "https://dlax.siplproducts.com";

const SEGOE =
  "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";
const MS_BLUE = "#0067B8";
const MS_BLUE_HOVER = "#106EBE";
const MS_INK = "#1B1B1B";
const MS_MUTED = "#605E5C";
const MS_BORDER = "#E5E5E5";

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
      className="relative min-h-screen w-full bg-white flex flex-col"
      style={{ fontFamily: SEGOE, color: MS_INK }}
    >
      {/* Local input styles — underline only */}
      <style>{`
        .ms-input {
          width: 100%;
          height: 36px;
          padding: 0 28px 0 4px;
          border: 0;
          border-bottom: 1px solid ${MS_MUTED};
          background: #ffffff;
          color: ${MS_INK};
          font-family: ${SEGOE};
          font-size: 15px;
          outline: none;
          transition: border-color 0.15s ease, padding 0.15s ease;
        }
        .ms-input::placeholder { color: #A19F9D; }
        .ms-input:hover { border-bottom-color: ${MS_INK}; }
        .ms-input:focus {
          border-bottom: 2px solid ${MS_BLUE};
          padding-bottom: 0;
        }
        .ms-btn {
          height: 32px;
          min-width: 108px;
          padding: 0 16px;
          background: ${MS_BLUE};
          color: #ffffff;
          font-family: ${SEGOE};
          font-size: 15px;
          font-weight: 600;
          border: 1px solid ${MS_BLUE};
          border-radius: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background-color 0.12s ease, border-color 0.12s ease;
        }
        .ms-btn:hover:not(:disabled) { background: ${MS_BLUE_HOVER}; border-color: ${MS_BLUE_HOVER}; }
        .ms-btn:disabled { opacity: 0.7; cursor: default; }
        .ms-link {
          color: ${MS_BLUE};
          font-size: 13px;
          text-decoration: none;
        }
        .ms-link:hover { text-decoration: underline; }
      `}</style>

      {/* Header: KPC logo top-left */}
      <header className="px-6 sm:px-10 pt-6 sm:pt-8">
        <KpcLogo variant="on-light" className="h-7 w-auto" />
      </header>

      {/* Main: centered card */}
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-[440px] flex flex-col gap-6">
          {/* Card */}
          <div
            className="w-full bg-white"
            style={{
              border: `1px solid ${MS_BORDER}`,
              boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
              padding: "44px",
            }}
          >
            {/* Brand row */}
            <div className="flex items-center gap-2 mb-6">
              <KpcLogo variant="on-light" className="h-5 w-auto" />
              <span
                className="text-[13px] font-semibold tracking-wide"
                style={{ color: MS_INK }}
              >
                DLAX
              </span>
            </div>

            <h1
              className="text-[24px] leading-tight"
              style={{ color: MS_INK, fontWeight: 600 }}
            >
              Sign in
            </h1>
            <p className="mt-1 text-[15px]" style={{ color: MS_MUTED }}>
              to continue to DLAX
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
              {/* User ID */}
              <div>
                <label
                  htmlFor="userId"
                  className="block text-[13px] mb-1"
                  style={{ color: MS_INK, fontWeight: 600 }}
                >
                  User ID
                </label>
                <input
                  id="userId"
                  className="ms-input"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="someone@example.com"
                />
                <p className="mt-1 text-[12px]" style={{ color: MS_MUTED }}>
                  Enter your User ID only — not your full email address.
                </p>
              </div>

              {/* Password */}
              <div className="mt-5">
                <label
                  htmlFor="password"
                  className="block text-[13px] mb-1"
                  style={{ color: MS_INK, fontWeight: 600 }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    className="ms-input"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-0 top-0 h-9 w-8 flex items-center justify-center"
                    style={{ color: MS_MUTED }}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Helper link */}
              <div className="mt-4">
                <a href="#" className="ms-link" onClick={(e) => e.preventDefault()}>
                  Can't access your account?
                </a>
              </div>

              {/* Button row — right aligned */}
              <div className="mt-8 flex justify-end">
                <button type="submit" className="ms-btn" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </div>
            </form>

            <p className="mt-8 text-[13px]" style={{ color: MS_MUTED }}>
              Don't have an account?{" "}
              <a
                href="#"
                className="ms-link"
                onClick={(e) => e.preventDefault()}
              >
                Contact your administrator
              </a>
            </p>
          </div>

          {/* QR install — flat, matches Microsoft tone */}
          <div
            className="w-full bg-white flex items-center gap-3"
            style={{
              border: `1px solid ${MS_BORDER}`,
              padding: "12px 14px",
            }}
          >
            <div className="shrink-0 bg-white" style={{ padding: 2 }}>
              <QRCodeSVG value={INSTALL_URL} size={56} level="M" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" style={{ color: MS_BLUE }} />
                <p
                  className="text-[13px]"
                  style={{ color: MS_INK, fontWeight: 600 }}
                >
                  Install on Mobile
                </p>
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: MS_MUTED }}>
                Scan with your phone camera, then tap "Add to Home Screen".
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 sm:px-10 pb-5">
        <div
          className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-[12px]"
          style={{ color: MS_MUTED }}
        >
          <a
            href="#"
            className="hover:underline"
            onClick={(e) => e.preventDefault()}
            style={{ color: MS_MUTED }}
          >
            Terms of use
          </a>
          <a
            href="#"
            className="hover:underline"
            onClick={(e) => e.preventDefault()}
            style={{ color: MS_MUTED }}
          >
            Privacy &amp; cookies
          </a>
          <span>© 2026 Sharvi Infotech Pvt Ltd</span>
        </div>
      </footer>
    </div>
  );
}
