import { useEffect, useState } from "react";
import { Download, Check, Share } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (/(macintosh)/i.test(ua) && "ontouchend" in document);
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
  const [ios, setIos] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIos(isIos());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted) return null;

  const baseBtn =
    "inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] hover:bg-white/[0.1] hover:border-amber-300/40 transition-all";

  if (installed) {
    return (
      <div className={`${baseBtn} cursor-default opacity-80`}>
        <Check className="h-4 w-4 text-emerald-300" />
        App Installed
      </div>
    );
  }

  const handleClick = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } finally {
      setDeferred(null);
    }
  };

  if (ios) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={baseBtn}>
            <Download className="h-4 w-4 text-amber-300" />
            Install App
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-sm" side="top">
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
        </PopoverContent>
      </Popover>
    );
  }

  if (!deferred) return null;

  return (
    <button type="button" onClick={handleClick} className={baseBtn}>
      <Download className="h-4 w-4 text-amber-300" />
      Install App
    </button>
  );
}
