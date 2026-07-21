"use client";

import { useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type Track = {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
};

export default function SearchPanel({
  onAdd,
  className,
}: {
  onAdd: (t: Track) => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});

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
    <div className={cn("min-h-0 flex-col", className)}>
      <div className="flex shrink-0 gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-10"
            placeholder="Search YouTube Music…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <Button variant="accent" onClick={search} disabled={loading} className="px-5">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
        </Button>
      </div>

      <ul className="sw-scroll mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto md:max-h-80">
        {results.length === 0 && !loading && (
          <li className="grid flex-1 place-items-center py-10 text-center text-sm text-muted">
            Search for a track to add it to the queue.
          </li>
        )}
        {results.map((t) => (
          <li
            key={t.videoId}
            className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-white/5"
          >
            {t.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.thumbnail} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="size-11 shrink-0 rounded-lg bg-white/5" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{t.title}</div>
              <div className="truncate text-xs text-muted">{t.artist}</div>
            </div>
            <Button
              variant={added[t.videoId] ? "outline" : "accent"}
              size="sm"
              className="shrink-0 gap-1"
              onClick={() => {
                onAdd(t);
                setAdded((a) => ({ ...a, [t.videoId]: true }));
              }}
            >
              <Plus className="size-3.5" /> {added[t.videoId] ? "Added" : "Add"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
