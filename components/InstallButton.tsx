"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

// "Install app" affordance for the room. On Chrome/Edge/Android it triggers the
// native install (with the room-specific manifest → opens back into this room).
// On iOS Safari there's no prompt API, so we show a short Add-to-Home hint.
export default function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);

    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    // @ts-expect-error legacy iOS standalone flag
    const iosStandalone = window.navigator.standalone;
    if (isIos && !iosStandalone) setIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <button
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[var(--accent)] to-[#6b3ff0] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_20px_-6px_var(--accent)] transition-transform hover:scale-105"
      >
        <Download className="size-3.5" /> Install app
      </button>
    );
  }

  if (iosHint) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink/70">
        <Share className="size-3.5" /> Add to Home Screen
      </span>
    );
  }

  return null;
}
