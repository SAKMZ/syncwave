"use client";

import { memo, useCallback, useEffect, useState } from "react";
import {
  ArrowBigUp,
  Check,
  Clock,
  Heart,
  ListMusic,
  Loader2,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Status, Track } from "@/lib/types";
import { useListTransition } from "@/hooks/useListTransition";
import { useReorder } from "@/hooks/useReorder";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/panel";
import { CountButton, DragHandle, RowAction, TrackRow } from "@/components/ui/track-row";

function fmt(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
}

const keyOf = (t: Track) => t.id ?? t.videoId;

function QueuePanel({
  queue,
  dl,
  isHost,
  you,
  onRemove,
  onLike,
  onVote,
  onReorder,
  onOpenSearch,
  className,
}: {
  queue: Track[];
  dl: Record<string, number>;
  isHost: boolean;
  /** Your nickname — likes and votes are recorded against it. */
  you: string;
  onRemove: (id: string) => void;
  onLike: (id: string) => void;
  onVote: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
  onOpenSearch: () => void;
  className?: string;
}) {
  const totalSec = queue.reduce((n, t) => n + (t.duration || 0), 0);
  const mins = Math.round(totalSec / 60);

  // One clock for the whole list rather than a timer per row.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const rows = useListTransition(queue, keyOf);
  const { state, start, move, end, shiftFor } = useReorder(onReorder);

  const indexOf = useCallback((key: string) => queue.findIndex((t) => keyOf(t) === key), [queue]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <SectionHeader
        icon={<ListMusic className="size-3.5" />}
        title="Up next"
        trailing={
          queue.length > 0 ? (
            <span className="text-[11px] text-muted">
              {queue.length} {queue.length === 1 ? "track" : "tracks"}
              {mins > 0 ? ` · ${mins} min` : ""}
            </span>
          ) : undefined
        }
      />

      {queue.length === 0 ? (
        // Compact on purpose: an empty queue hands its height to the
        // suggestions below it rather than filling the column with a notice.
        <EmptyState
          compact
          icon={<ListMusic className="size-5" />}
          title="The queue is empty"
          hint="Anyone in the room can add a track."
          action={
            <Button variant="secondary" size="sm" onClick={onOpenSearch} className="gap-1.5">
              <SearchIcon className="size-3.5" /> Find a song
            </Button>
          }
        />
      ) : (
        <ul className="sw-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {rows.map(({ item: t, key, exiting }) => {
            const i = indexOf(key);
            const liked = (t.likes ?? []).includes(you);
            const voted = (t.votes ?? []).includes(you);
            const id = t.id;

            return (
              <TrackRow
                key={key}
                index={exiting ? undefined : i + 1}
                art={t.thumbnail}
                title={t.title}
                artist={t.artist}
                addedBy={t.addedBy}
                addedAt={t.addedAt}
                now={now}
                exiting={exiting}
                dragging={state.activeKey === key}
                shift={exiting ? 0 : shiftFor(i)}
                dragHandle={
                  isHost && !exiting ? (
                    <DragHandle
                      onPointerDown={(e) => start(e, key, i, queue.length)}
                      onPointerMove={move}
                      onPointerUp={end}
                      onPointerCancel={end}
                      onKeyDown={(e) => {
                        if (!id) return;
                        // Keyboard parity for the drag: the whole point of a
                        // host-ordered queue is lost if you need a mouse.
                        if (e.key === "ArrowUp" && i > 0) {
                          e.preventDefault();
                          onReorder(id, i - 1);
                        }
                        if (e.key === "ArrowDown" && i < queue.length - 1) {
                          e.preventDefault();
                          onReorder(id, i + 1);
                        }
                      }}
                    />
                  ) : undefined
                }
                trailing={
                  <>
                    <CountButton
                      icon={<ArrowBigUp className="size-3.5" />}
                      count={t.votes?.length ?? 0}
                      active={voted}
                      // Says what it does, because a vote that silently moves
                      // the queue is a surprise the second time too.
                      label={
                        voted
                          ? `You bumped this — ${t.votes?.length ?? 0} votes`
                          : `Bump ${t.title} up the queue`
                      }
                      onClick={id && !voted ? () => onVote(id) : undefined}
                      disabled={voted}
                    />
                    <CountButton
                      icon={<Heart className={cn("size-3.5", liked && "fill-current")} />}
                      count={t.likes?.length ?? 0}
                      active={liked}
                      tone="pink"
                      label={liked ? `Unlike ${t.title}` : `Like ${t.title}`}
                      onClick={id ? () => onLike(id) : undefined}
                    />
                    <span className="hidden font-mono text-[11px] tabular-nums text-muted lg:inline">
                      {fmt(t.duration)}
                    </span>
                    <QueueStatus status={t.status} live={dl[t.videoId]} />
                  </>
                }
                actions={
                  isHost && id ? (
                    <RowAction label={`Remove ${t.title}`} tone="danger" onClick={() => onRemove(id)}>
                      <X className="size-3.5" />
                    </RowAction>
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Whether this track is ready to play the moment it reaches the front. */
function QueueStatus({ status, live }: { status?: Status; live?: number }) {
  const pct = live ?? status?.percent ?? 0;
  const state = live != null && live < 100 ? "downloading" : (status?.state ?? "pending");

  if (state === "cached")
    return <Check className="size-4 shrink-0 text-[var(--success)]" aria-label="ready" />;
  if (state === "downloading")
    return (
      <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-[var(--accent-2)]">
        <Loader2 className="size-3.5 animate-spin" />
        {pct}%
      </span>
    );
  return <Clock className="size-4 shrink-0 text-muted" aria-label="queued" />;
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(QueuePanel);
