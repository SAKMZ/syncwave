"use client";

import { useEffect, useRef, useState } from "react";
import {
  ShieldAlert,
  Upload,
  Check,
  Trash2,
  Loader2,
  TriangleAlert,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CookiesStatus = {
  present: boolean;
  source: "env" | "upload" | null;
  uploadedAt: number | null;
};

export default function CookiesPanel({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<CookiesStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/cookies")
      .then((r) => (r.ok ? r.json() : { cookies: null }))
      .then((d) => setStatus(d.cookies))
      .catch(() => {});
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/cookies", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: text,
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Upload failed.");
      } else {
        setStatus(d.cookies);
        setNote(
          d.cookies?.loggedIn === false
            ? "Saved, but no login cookie was found — you may have exported while signed out."
            : "Saved. The next track will use it."
        );
      }
    } catch {
      setError("Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    setNote("");
    const res = await fetch("/api/admin/cookies", { method: "DELETE" });
    const d = await res.json();
    setStatus(d.cookies);
    setBusy(false);
  }

  const fromEnv = status?.source === "env";

  return (
    <div className="grid gap-4">
      {/* Why this exists */}
      <div className="rounded-sm border border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-accent-soft p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-accent-2" />
          <div className="text-sm">
            <p className="font-semibold text-ink">Why Syncwave needs this</p>
            <p className="mt-1 text-muted">
              YouTube blocks anonymous downloads from datacenter IPs with{" "}
              <em>&ldquo;Sign in to confirm you&rsquo;re not a bot&rdquo;</em>. Without a
              cookies file, tracks will fail to load on almost any cloud host
              (Railway, Render, most VPS providers). Home servers usually work
              without it.
            </p>
          </div>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div
          className={`flex items-center gap-2 rounded-sm border px-4 py-3 text-sm ${
            status.present
              ? "border-soft-border bg-white/5 text-ink"
              : "border-soft-border bg-white/5 text-muted"
          }`}
        >
          {status.present ? (
            <>
              <Check className="size-4 text-accent-2" />
              <span>
                Cookies active
                {fromEnv ? (
                  <span className="text-muted"> — provided by YTDLP_COOKIES_FILE</span>
                ) : status.uploadedAt ? (
                  <span className="text-muted">
                    {" "}
                    — uploaded {new Date(status.uploadedAt).toLocaleString()}
                  </span>
                ) : null}
              </span>
            </>
          ) : (
            <>
              <TriangleAlert className="size-4 text-muted" />
              <span>No cookies file. Playback may fail on this host.</span>
            </>
          )}
        </div>
      )}

      {/* How to get one */}
      {!compact && (
        <ol className="grid gap-2 rounded-sm border border-soft-border bg-white/[0.03] p-4 text-sm text-muted">
          <li className="font-semibold text-ink">How to get your cookies.txt</li>
          <li>
            1. Install a <strong className="text-ink">&ldquo;Get cookies.txt LOCALLY&rdquo;</strong>{" "}
            extension for Chrome or Firefox.
          </li>
          <li>
            2. Open{" "}
            <a
              href="https://www.youtube.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent-2 hover:underline"
            >
              youtube.com <ExternalLink className="size-3" />
            </a>{" "}
            and make sure you are <strong className="text-ink">signed in</strong>.
          </li>
          <li>
            3. Click the extension and export in{" "}
            <strong className="text-ink">Netscape</strong> format (a{" "}
            <code className="text-accent-2">cookies.txt</code> file).
          </li>
          <li>4. Upload it below.</li>
        </ol>
      )}

      {/* Privacy warning — this is a live session, treat it as a credential */}
      <div className="flex items-start gap-3 rounded-sm border border-soft-border bg-white/[0.03] p-4 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted" />
        <p className="text-muted">
          <strong className="text-ink">Use a throwaway Google account.</strong> This file
          is a live login session — every track this server fetches will be
          requested as that account, and heavy use can get it rate-limited or
          banned. Never use your main account on an instance other people can reach.
        </p>
      </div>

      {error && (
        <p className="rounded-sm border border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
      {note && !error && <p className="text-sm text-accent-2">{note}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <Button
          variant="accent"
          disabled={busy || fromEnv}
          onClick={() => fileRef.current?.click()}
          className="gap-1.5"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {status?.present ? "Replace cookies.txt" : "Upload cookies.txt"}
        </Button>
        {status?.present && !fromEnv && (
          <Button variant="outline" disabled={busy} onClick={remove} className="gap-1.5">
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
      </div>

      {fromEnv && (
        <p className="text-xs text-muted">
          A cookies file is being supplied by the{" "}
          <code className="text-accent-2">YTDLP_COOKIES_FILE</code> environment
          variable, so uploading is disabled. Unset it to manage cookies here.
        </p>
      )}
    </div>
  );
}
