"use client";

import { memo, useMemo, useState } from "react";
import { History as HistoryIcon, Plus, SkipForward } from "lucide-react";
import { cn } from "@/lib/cn";
import type { HistoryEntry, Track } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/panel";
import { CountButton, RowAction, TrackRow } from "@/components/ui/track-row";
import { Heart } from "lucide-react";

/**
 * What the room has already been through.
 *
 * Newest first, and deliberately the same rows as the queue: a track you
 * recognise from ten minutes ago should look identical whichever list it is
 * sitting in, and re-adding it should be the same one-tap gesture as adding it
 * from search.
 */

/** Rendered in pages rather than all at once — see below. */
const PAGE = 40;

function fmtPlayed(sec: number, duration: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const played = `${m}:${s.toString().padStart(2, "0")}`;
  if (!duration) return played;
  return `${played} of ${Math.floor(duration / 60)}:${Math.floor(duration % 60)
    .toString()
    .padStart(2, "0")}`;
}

function HistoryPanel({
  history,
  onReAdd,
  className,
}: {
  history: HistoryEntry[];
  onReAdd: (t: Track) => void;
  className?: string;
}) {
  const [showSkipped, setShowSkipped] = useState(true);
  // The history is capped server-side at 120, so this is a DOM budget rather
  // than a windowing scheme: nobody scrolls to the bottom of a listening
  // session, and rendering forty rows instead of a hundred and twenty is the
  // whole of the win a virtualiser would have bought here.
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const filtered = showSkipped ? history : history.filter((h) => !h.skipped);
    return [...filtered].reverse();
  }, [history, showSkipped]);

  const skippedCount = history.filter((h) => h.skipped).length;
  const shown = rows.slice(0, limit);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <SectionHeader
        icon={<HistoryIcon className="size-3.5" />}
        title="History"
        trailing={
          history.length > 0 ? (
            <>
              <span className="text-[11px] text-muted">
                {history.length} played
              </span>
              {skippedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSkipped((v) => !v)}
                  aria-pressed={!showSkipped}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    "transition-[background-color,border-color,color] duration-200 ease-[var(--ease)]",
                    showSkipped
                      ? "border-white/10 bg-white/[0.04] text-muted hover:text-ink"
                      : "border-[color:color-mix(in_oklab,var(--accent)_50%,transparent)] bg-accent-soft text-[var(--accent-2)]"
                  )}
                  title={showSkipped ? "Hide skipped tracks" : "Show skipped tracks"}
                >
                  <SkipForward className="size-3" />
                  {skippedCount}
                </button>
              )}
            </>
          ) : undefined
        }
      />

      {history.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="size-5" />}
          title="Nothing has played yet"
          hint="Once the room gets going, everything it has heard collects here — ready to play again."
        />
      ) : (
        <ul className="sw-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {shown.map((h) => (
            <TrackRow
              key={h.id}
              art={h.thumbnail}
              title={h.title}
              artist={h.artist}
              addedBy={h.addedBy}
              muted={h.skipped}
              trailing={
                <>
                  {h.skipped && (
                    <span
                      className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-muted"
                      title={`Skipped after ${fmtPlayed(h.playedSec, h.duration)}`}
                    >
                      <SkipForward className="size-3" /> Skipped
                    </span>
                  )}
                  <CountButton
                    icon={<Heart className={cn("size-3.5", h.likes.length > 0 && "fill-current")} />}
                    count={h.likes.length}
                    active={h.likes.length > 0}
                    tone="pink"
                    label={
                      h.likes.length
                        ? `Liked by ${h.likes.join(", ")}`
                        : "Nobody liked this one"
                    }
                  />
                  <span
                    className="hidden font-mono text-[11px] tabular-nums text-muted lg:inline"
                    title={`Played ${fmtPlayed(h.playedSec, h.duration)}`}
                  >
                    {fmtPlayed(h.playedSec, 0)}
                  </span>
                </>
              }
              actions={
                <RowAction
                  label={`Play ${h.title} again`}
                  tone="accent"
                  onClick={() =>
                    onReAdd({
                      videoId: h.videoId,
                      title: h.title,
                      artist: h.artist,
                      duration: h.duration,
                      thumbnail: h.thumbnail,
                      art: h.art,
                    })
                  }
                >
                  <Plus className="size-4" />
                </RowAction>
              }
            />
          ))}

          {rows.length > shown.length && (
            <li className="py-2 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                Show earlier ({rows.length - shown.length})
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(HistoryPanel);
