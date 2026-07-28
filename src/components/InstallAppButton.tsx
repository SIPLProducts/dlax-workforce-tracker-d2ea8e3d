import { useEffect, useState } from "react";
import { Download, Check, Share, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PWA_UPDATE_EVENT } from "@/pwa-register";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua) || (/(macintosh)/i.test(ua) && "ontouchend" in document)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [mounted, setMounted] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const onUpdate = () => setUpdateReady(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
    };
  }, []);

  if (!mounted) return null;

  const baseBtn =
    "inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] hover:bg-white/[0.1] hover:border-amber-300/40 transition-all";

  if (installed && !updateReady) {
    return (
      <div className={`${baseBtn} cursor-default opacity-80`}>
        <Check className="h-4 w-4 text-emerald-300" />
        App Installed
      </div>
    );
  }

  if (updateReady) {
    const handleUpdate = async () => {
      try {
        if (typeof window.__dlaxUpdateSW === "function") {
          await window.__dlaxUpdateSW(true);
        } else {
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    };
    return (
      <button type="button" onClick={handleUpdate} className={baseBtn}>
        <RefreshCw className="h-4 w-4 text-amber-300" />
        Update Available
      </button>
    );
  }

  const handleNativePrompt = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } finally {
      setDeferred(null);
    }
  };

  const handleClick = async () => {
    if (deferred) {
      await handleNativePrompt();
      return;
    }
    setPopoverOpen(true);
  };

  const instructions =
    platform === "ios" ? (
      <div className="space-y-2">
        <p className="font-semibold text-slate-900">Install on iPhone / iPad</p>
        <ol className="list-decimal pl-4 space-y-1 text-slate-600">
          <li>
            Tap the <Share className="inline h-3.5 w-3.5 align-[-2px]" /> Share button in Safari.
          </li>
          <li>Choose <span className="font-medium">Add to Home Screen</span>.</li>
          <li>Tap <span className="font-medium">Add</span>.</li>
        </ol>
      </div>
    ) : platform === "android" ? (
      <div className="space-y-2">
        <p className="font-semibold text-slate-900">Install on Android</p>
        <ol className="list-decimal pl-4 space-y-1 text-slate-600">
          <li>Open this site in <span className="font-medium">Chrome</span> or Edge.</li>
          <li>Tap the browser menu (⋮).</li>
          <li>Choose <span className="font-medium">Install app</span> or <span className="font-medium">Add to Home screen</span>.</li>
        </ol>
        <p className="text-[11px] text-slate-500">If you don't see the option yet, browse the site for a few seconds and try again.</p>
      </div>
    ) : (
      <div className="space-y-2">
        <p className="font-semibold text-slate-900">Install on Desktop</p>
        <ol className="list-decimal pl-4 space-y-1 text-slate-600">
          <li>Open this site in <span className="font-medium">Chrome</span> or Edge.</li>
          <li>Click the install icon in the address bar, or use menu → <span className="font-medium">Install DLAX</span>.</li>
        </ol>
      </div>
    );

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button type="button" onClick={handleClick} className={baseBtn}>
          <Download className="h-4 w-4 text-amber-300" />
          Install App
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="top">
        {instructions}
      </PopoverContent>
    </Popover>
  );
}
