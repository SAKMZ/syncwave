"use client";

import { memo, useEffect, useState } from "react";
import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Mood, Track } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/panel";
import { TrackRowSkeleton } from "@/components/ui/skeleton";
import { RowAction, TrackRow } from "@/components/ui/track-row";

/**
 * Somewhere to go next, so an empty queue is a suggestion rather than a blank
 * panel.
 *
 * Two sources, and the header names whichever one answered. With the AI DJ on,
 * the active persona picks in its own taste with the room's mood in hand; with
 * it off, this is a search for the current artist. Saying which is not a
 * detail — "recommended" with an unstated basis invites people to read
 * intention into a string match.
 */
function Recommendations({
  seed,
  mood,
  excludeIds,
  onAdd,
  limit = 5,
  className,
}: {
  /** The track to draw from — normally whatever is playing. */
  seed: Track | null;
  mood: Mood | null;
  /** videoIds already playing or queued; never suggest those back. */
  excludeIds: Set<string>;
  onAdd: (t: Track) => void;
  limit?: number;
  className?: string;
}) {
  const [results, setResults] = useState<Track[]>([]);
  const [source, setSource] = useState<"dj" | "artist" | "none">("none");
  const [dj, setDj] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [nonce, setNonce] = useState(0);

  // Primitives, not the object: `seed` gets a fresh identity on every playback
  // broadcast, and refetching suggestions several times a second would be rude
  // to both YouTube Music and whatever model is behind the DJ.
  const title = seed?.title ?? "";
  const artist = seed?.artist ?? "";
  const moodId = mood?.id ?? "";

  useEffect(() => {
    if (!artist) {
      setResults([]);
      setSource("none");
      return;
    }
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ title, artist, limit: String(limit) });
    if (moodId) params.set("mood", moodId);

    fetch(`/api/recommend?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setResults(Array.isArray(d.results) ? d.results : []);
        setSource(d.source ?? "none");
        setDj(d.dj ?? null);
      })
      .catch(() => {
        // A failed suggestion is not worth an error state; the section stays
        // out of the way until the next track changes it.
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [title, artist, moodId, limit, nonce]);

  const shown = results.filter((t) => !excludeIds.has(t.videoId)).slice(0, limit);

  // Nothing playing and nothing to suggest — the queue panel above is already
  // saying "add a track", so don't say it twice.
  if (!seed && !loading) return null;

  const basis =
    source === "dj" && dj
      ? `${dj}'s pick${mood ? ` · ${mood.label.toLowerCase()}` : ""}`
      : seed
        ? `from ${seed.artist}`
        : null;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <SectionHeader
        icon={<Sparkles className="size-3.5" />}
        title={source === "dj" ? "The DJ suggests" : "More like this"}
        trailing={
          <>
            {basis && (
              <span className="max-w-[12rem] truncate text-[11px] text-muted">{basis}</span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setNonce((n) => n + 1)}
              disabled={loading || !seed}
              aria-label="Suggest something else"
              title="Suggest something else"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </>
        }
      />

      <ul className="sw-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
        {loading && shown.length === 0 && <TrackRowSkeleton count={3} />}

        {!loading && shown.length === 0 && (
          <li className="flex flex-1">
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="No suggestions right now"
              hint="Search for something instead — anything you add seeds the next set."
            />
          </li>
        )}

        {shown.map((t) => (
          <TrackRow
            key={t.videoId}
            art={t.thumbnail}
            title={t.title}
            artist={t.artist}
            actions={
              <RowAction
                label={added[t.videoId] ? `${t.title} added` : `Add ${t.title}`}
                tone="accent"
                onClick={() => {
                  onAdd(t);
                  setAdded((a) => ({ ...a, [t.videoId]: true }));
                }}
              >
                <Plus
                  className={cn(
                    "size-4 transition-transform duration-200 ease-[var(--ease)]",
                    added[t.videoId] && "rotate-45"
                  )}
                />
              </RowAction>
            }
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(Recommendations);
