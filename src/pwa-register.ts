// Guarded PWA service worker registration.
// Never registers in dev, iframe preview, or Lovable preview hosts.
// Follows the Lovable PWA skill (offline path).

export function registerAppPWA() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const host = window.location.hostname;
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const inIframe = window.top !== window.self;
  const killed = url.searchParams.get("sw") === "off";

  const refuse = !import.meta.env.PROD || inIframe || isPreviewHost || killed;

  if (refuse) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((r) => {
            const swUrl = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
            if (swUrl.endsWith("/sw.js")) r.unregister().catch(() => {});
          });
        })
        .catch(() => {});
    }
    return;
  }

  // Dynamic import so the virtual module is only pulled into the prod bundle.
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // no-op — plugin missing or blocked
    });
}
