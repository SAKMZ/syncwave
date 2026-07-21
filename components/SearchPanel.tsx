"use client";

import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Track = {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
};

export default function SearchPanel({ onAdd }: { onAdd: (t: Track) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-soft-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
        <Search className="size-3.5" /> Add a song
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="search YouTube Music…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button variant="accent" onClick={search} disabled={loading}>
          {loading ? "…" : "Search"}
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="sw-scroll mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
          {results.map((t) => (
            <li
              key={t.videoId}
              className="flex items-center gap-3 rounded-md p-1 hover:bg-white/5"
            >
              {t.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.thumbnail} alt="" className="size-10 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{t.title}</div>
                <div className="truncate text-xs text-muted">{t.artist}</div>
              </div>
              <Button
                variant="accent"
                size="sm"
                className="gap-1"
                onClick={() => {
                  onAdd(t);
                  setResults([]);
                  setQ("");
                }}
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
