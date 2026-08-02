"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, HardDrive, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Stats = {
  bytes: number;
  files: number;
  limitBytes: number;
  retentionHours: number;
  oldestPlayed: number | null;
};

const fmt = (n: number) =>
  n >= 1073741824 ? `${(n / 1073741824).toFixed(1)} GB` : `${Math.round(n / 1048576)} MB`;

/**
 * What the audio cache is costing you.
 *
 * Worth showing rather than leaving to a log line: this usually runs on a
 * machine somebody also lives on, and "why is my disk full" is a bad way to
 * discover that a listening room has been busy.
 */
export default function StoragePanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/admin/cache")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.cache && setStats(d.cache))
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function act(action: "purge" | "sweep") {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/admin/cache", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Request failed — are you still signed in?");
      const d = await res.json();
      setStats(d.cache);
      setNote(
        action === "purge"
          ? `Cleared ${d.removed} track${d.removed === 1 ? "" : "s"}, freed ${fmt(d.freed || 0)}.`
          : "Swept. Anything past the limit or the retention window is gone."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!stats) {
    return <p className="text-sm text-muted">Checking disk usage…</p>;
  }

  const capped = stats.limitBytes > 0;
  const pct = capped ? Math.min(100, (stats.bytes / stats.limitBytes) * 100) : 0;
  const tight = pct >= 80;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Played tracks are cached to disk so a repeat play costs nothing. They&rsquo;re
        dropped after {stats.retentionHours}h without a play
        {capped ? ", and the oldest go early if the cache outgrows its limit." : "."}
      </p>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-ink">
            {fmt(stats.bytes)}{" "}
            <span className="text-muted">
              across {stats.files} track{stats.files === 1 ? "" : "s"}
            </span>
          </span>
          {capped && (
            <span className={cn("text-xs", tight ? "text-[var(--warning)]" : "text-muted")}>
              limit {fmt(stats.limitBytes)}
            </span>
          )}
        </div>
        {capped && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                tight ? "bg-[var(--warning)]" : "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-3)]"
              )}
              style={{ width: `${Math.max(pct, stats.bytes > 0 ? 2 : 0)}%` }}
            />
          </div>
        )}
        {!capped && (
          <p className="text-xs text-muted">
            No limit set. <code className="text-accent-2">CACHE_MAX_MB</code> caps it.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => act("sweep")}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <HardDrive className="size-3.5" />}
          Sweep now
        </Button>
        <Button variant="outline" size="sm" disabled={busy || !stats.files} onClick={() => act("purge")}>
          Clear all
        </Button>
      </div>
      <p className="text-xs text-muted">
        Clearing is safe — rooms and queues are untouched, tracks just download again
        the next time someone plays them.
      </p>

      {note && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--success)]">
          <Check className="size-4" /> {note}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--destructive)]">
          <TriangleAlert className="size-4" /> {error}
        </p>
      )}
    </div>
  );
}
