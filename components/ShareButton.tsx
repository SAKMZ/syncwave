"use client";

import { useEffect, useState } from "react";
import { Link2, Check, Globe, Wifi, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Share the room.
 *
 * The host almost always has the app open on localhost, so copying the address
 * bar would hand friends a link only the host can open. The server knows the
 * address the outside world can reach — a tunnel, a domain, whatever — and that
 * is what gets offered when it exists.
 */
export default function ShareButton({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let alive = true;
    const load = () =>
      fetch("/api/share")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && setPublicUrl(d?.publicUrl || null))
        .catch(() => {});
    load();
    // The tunnel can come up after the room is already open.
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const isLocal = /^https?:\/\/(localhost|127\.|\[?::1)/i.test(origin);
  const base = publicUrl || origin;
  const link = base ? `${base}/r/${code}` : "";
  // Reachable by people elsewhere, rather than only on this machine or LAN.
  const reachable = Boolean(publicUrl) || (!isLocal && /^https:/.test(origin));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      return;
    }
    setCopied("link");
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
        // The label is hidden below sm:, which would otherwise leave a button
        // with no accessible name on exactly the devices most people use.
        aria-label="Share this room"
        aria-expanded={open}
      >
        <Link2 className="size-3.5" />
        <span className="hidden sm:inline">Share</span>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="sw-fade-in absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-white/10 bg-[var(--popover)] p-4 shadow-xl">
            <div className="sw-label mb-3">
              {reachable ? <Globe className="size-3.5" /> : <Wifi className="size-3.5" />}
              {reachable ? "Anyone can join with this" : "Local network only"}
            </div>

            <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.04] p-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-1 text-xs text-ink outline-none"
                aria-label="Room link"
              />
              <Button variant="accent" size="sm" onClick={copy} className="shrink-0 gap-1.5">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <p className={cn("mt-3 text-xs", reachable ? "text-muted" : "text-[var(--warning)]")}>
              {reachable ? (
                <>
                  Send this to anyone — they don&rsquo;t need an account, and the room code is{" "}
                  <span className="font-mono font-semibold text-ink">{code}</span>.
                </>
              ) : (
                <>
                  This link only works on your network. Restart Syncwave without{" "}
                  <code className="text-accent-2">--local</code> to get a public link you can send
                  to anyone.
                </>
              )}
            </p>

            {reachable && publicUrl && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted">
                <QrCode className="mt-0.5 size-3 shrink-0" />
                The address changes each time you restart Syncwave.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
