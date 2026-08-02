"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, Lock } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

// Shared PWA install detection. Returns what install affordance (if any) makes
// sense for the current browser/context.
function useInstallState() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [secure, setSecure] = useState(true);

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
    const ios = /iphone|ipad|ipod/i.test(ua);
    // @ts-expect-error legacy iOS standalone flag
    const iosStandalone = window.navigator.standalone;
    if (ios && iosStandalone) setInstalled(true);
    setIsIos(ios);

    // PWA install + service workers require a secure context (HTTPS or
    // localhost). On a plain-HTTP LAN IP the browser offers no install.
    setSecure(window.isSecureContext);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return { deferred, setDeferred, installed, isIos, secure };
}

// Compact "Install app" button for the room header.
export default function InstallButton() {
  const { deferred, setDeferred, installed, isIos } = useInstallState();
  if (installed) return null;

  if (deferred) {
    return (
      <button
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
        className="flex items-center gap-1.5 rounded-full bg-[image:var(--accent-gradient)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[var(--glow-accent)] transition-transform duration-200 ease-[var(--ease)] hover:scale-105"
      >
        <Download className="size-3.5" /> Install
      </button>
    );
  }

  if (isIos) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink/70">
        <Share className="size-3.5" /> Add to Home
      </span>
    );
  }

  return null;
}

// Prominent, dismissible install banner shown inside a room — the room's
// manifest makes the installed app open straight back into THIS room.
export function InstallBanner({ code }: { code: string }) {
  const { deferred, setDeferred, installed, isIos, secure } = useInstallState();
  const [dismissed, setDismissed] = useState(true); // default hidden until we check

  useEffect(() => {
    setDismissed(localStorage.getItem(`sw_install_dismissed_${code}`) === "1");
  }, [code]);

  if (installed || dismissed) return null;

  const close = () => {
    localStorage.setItem(`sw_install_dismissed_${code}`, "1");
    setDismissed(true);
  };

  // Decide the banner body. Nothing to show on a secure Android context until
  // the browser fires its install event — avoid nagging with manual steps.
  let body: React.ReactNode = null;
  if (deferred) {
    body = (
      <>
        <p className="text-sm text-ink">
          <span className="font-semibold">Install this room</span> — reopen it any time in one
          tap, no code needed.
        </p>
        <button
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
            close();
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[image:var(--accent-gradient)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--glow-accent)] transition-transform duration-200 ease-[var(--ease)] hover:scale-105"
        >
          <Download className="size-4" /> Install app
        </button>
      </>
    );
  } else if (isIos) {
    body = (
      <p className="text-sm text-ink">
        <span className="font-semibold">Add this room to your Home Screen</span> — tap{" "}
        <Share className="mx-0.5 inline size-3.5 align-text-bottom" /> Share, then{" "}
        <span className="font-medium">Add to Home Screen</span>.
      </p>
    );
  } else if (!secure) {
    body = (
      <p className="flex items-center gap-2 text-sm text-ink/80">
        <Lock className="size-4 shrink-0 text-accent-2" />
        <span>
          App install needs <span className="font-semibold">HTTPS</span>. Open this over a secure
          URL (e.g. a domain or a Tailscale/Cloudflare address) to install the room as an app.
        </span>
      </p>
    );
  }

  if (!body) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-3 backdrop-blur">
      <div className="flex flex-1 flex-wrap items-center justify-between gap-3">{body}</div>
      <button
        onClick={close}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-ink/50 transition-colors hover:bg-white/10 hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
