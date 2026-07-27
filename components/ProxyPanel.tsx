"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Network, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Saved = {
  hasWebshareKey: boolean;
  proxyListCount: number;
};

/**
 * Proxy pool configuration.
 *
 * Only useful on a host YouTube refuses — which is most cloud providers. Both
 * fields hold credentials, so neither value ever comes back from the server:
 * the form reports what is stored and takes a replacement, the same way the
 * LLM key field does.
 */
export default function ProxyPanel() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [list, setList] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.settings && setSaved(d.settings))
      .catch(() => {});
  }, []);

  async function save(patch: Record<string, string>) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Could not save — are you still signed in?");
      const d = await res.json();
      setSaved(d.settings);
      setApiKey("");
      setList("");
      setNote("Saved. The next track will use it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const count = saved?.proxyListCount ?? 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        YouTube refuses most datacenter IPs, so a cloud host often can&rsquo;t play
        anything. The refusal isn&rsquo;t uniform, though — Syncwave tries the direct
        connection first and, only if it&rsquo;s refused, falls back through a pool of
        proxies until one answers, remembering which worked.{" "}
        <span className="text-ink">Leave this empty when self-hosting at home.</span>
      </p>

      <div className="space-y-2">
        <Label htmlFor="webshare-key">Webshare API key</Label>
        <div className="flex gap-2">
          <Input
            id="webshare-key"
            type="password"
            autoComplete="off"
            placeholder={saved?.hasWebshareKey ? "•••••••• (stored)" : "paste your API token"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="accent"
            disabled={busy || !apiKey.trim()}
            onClick={() => save({ webshareApiKey: apiKey.trim() })}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
        <p className="text-xs text-muted">
          The proxy list is fetched and refreshed automatically.{" "}
          <a
            href="https://www.webshare.io/?referral_code=iw9gooahl4ty"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-2 hover:underline"
          >
            Get a free key <ExternalLink className="size-3" />
          </a>{" "}
          — 10 proxies and 1 GB/month, about 500 tracks. Referral link.
        </p>
        {saved?.hasWebshareKey && (
          <p className="flex items-center gap-1.5 text-xs text-[#7ee787]">
            <Check className="size-3" /> A key is stored. Saving again replaces it.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="proxy-list">Or your own proxies</Label>
        <Textarea
          id="proxy-list"
          rows={3}
          spellCheck={false}
          placeholder={
            count
              ? `${count} stored — paste a new list to replace them`
              : "http://user:pass@host:port, http://user:pass@host2:port"
          }
          value={list}
          onChange={(e) => setList(e.target.value)}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Any provider, comma or newline separated. Used instead of Webshare.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !list.trim()}
            onClick={() =>
              save({ proxyList: list.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).join(",") })
            }
          >
            Save list
          </Button>
        </div>
        {count > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-[#7ee787]">
            <Check className="size-3" /> {count} prox{count === 1 ? "y" : "ies"} stored.
          </p>
        )}
      </div>

      <p className="flex items-start gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted">
        <Network className="mt-0.5 size-3.5 shrink-0 text-accent-2" />
        <span>
          Proxy traffic is usually metered, so tracks fetched through one are capped at
          a lower bitrate — roughly 1.6&nbsp;MB instead of 4.3&nbsp;MB. Direct
          connections are never capped, and every track is cached for 72h, so a repeat
          play costs nothing.
        </span>
      </p>

      {note && (
        <p className="flex items-center gap-1.5 text-sm text-[#7ee787]">
          <Check className="size-4" /> {note}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-[#ff8b8b]">
          <TriangleAlert className="size-4" /> {error}
        </p>
      )}
    </div>
  );
}
