"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Headphones,
  Heart,
  ListPlus,
  LogIn,
  LogOut,
  Music,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ChatMsg, ReactionEvent, SystemKind } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/panel";

/**
 * What happened in the room, as distinct from what people said about it.
 *
 * These used to be grey sentences threaded through the conversation, which
 * meant a busy room buried the actual chat under "X joined" lines. Separating
 * them lets each one be what it is: chat is a conversation, this is a log.
 *
 * Newest first — the useful end of a log is the recent end, and this panel is
 * glanced at rather than read.
 */

type Item =
  | { id: string; ts: number; type: "system"; kind: SystemKind | "generic"; msg: ChatMsg }
  | { id: string; ts: number; type: "reaction"; reaction: ReactionEvent };

const ICON: Record<SystemKind | "generic" | "reaction", React.ElementType> = {
  joined: LogIn,
  left: LogOut,
  queued: ListPlus,
  nowplaying: Music,
  skipped: SkipForward,
  dj: Headphones,
  error: AlertTriangle,
  reaction: Heart,
  generic: ActivityIcon,
};

// Each event type gets one tint, drawn from the palette — never a new hue.
const TONE: Record<SystemKind | "generic" | "reaction", string> = {
  joined: "text-[var(--success)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)]",
  left: "text-muted bg-white/5",
  queued: "text-[var(--accent-2)] bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]",
  nowplaying: "text-[var(--accent-2)] bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]",
  skipped: "text-ink-soft bg-white/8",
  dj: "text-[var(--accent-2)] bg-[color-mix(in_oklab,var(--accent)_20%,transparent)]",
  error: "text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_14%,transparent)]",
  reaction: "text-[var(--accent-3)] bg-[color-mix(in_oklab,var(--accent-3)_14%,transparent)]",
  generic: "text-muted bg-white/5",
};

function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Re-render often enough that "now" becomes "1m ago" on its own. */
function useTicker(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function ActivityFeed({
  events,
  reactions,
  limit = 40,
  className,
}: {
  /** The full room log; system entries are picked out here. */
  events: ChatMsg[];
  /** Live reactions from this session — never persisted, so never replayed. */
  reactions: ReactionEvent[];
  limit?: number;
  className?: string;
}) {
  const now = useTicker();

  const items = useMemo<Item[]>(() => {
    const sys: Item[] = events
      .filter((m) => m.system)
      // `nowplaying` is the one system entry that belongs in the conversation —
      // it marks a moment everyone shared, so the chat renders it as a card and
      // the log leaves it alone rather than saying it twice.
      .filter((m) => m.kind !== "nowplaying")
      .map((m) => ({
        id: m.id,
        ts: m.ts,
        type: "system" as const,
        kind: m.kind ?? ("generic" as const),
        msg: m,
      }));
    const react: Item[] = reactions.map((r) => ({
      id: r.id,
      ts: r.ts,
      type: "reaction" as const,
      reaction: r,
    }));
    return [...sys, ...react].sort((a, b) => b.ts - a.ts).slice(0, limit);
  }, [events, reactions, limit]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <SectionHeader
        icon={<ActivityIcon className="size-3.5" />}
        title="Room activity"
        trailing={
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--success)]">
            <span className="sw-eq" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            Live
          </span>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="size-5" />}
          title="Nothing has happened yet"
          hint="Joins, queued tracks, skips and reactions show up here as they happen."
        />
      ) : (
        <ul className="sw-scroll -mr-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2">
          {items.map((it) => (
            <ActivityItem key={it.id} item={it} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityItem({ item, now }: { item: Item; now: number }) {
  const kind = item.type === "reaction" ? "reaction" : item.kind;
  const Icon = ICON[kind];
  const actor = item.type === "reaction" ? item.reaction.nick : item.msg.actor;

  return (
    <li className="sw-rise sw-row flex items-start gap-3 p-2">
      <span
        className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", TONE[kind])}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>

      {actor ? (
        <Avatar name={actor} size="sm" className="mt-0.5" />
      ) : (
        <span className="mt-0.5 size-6 shrink-0" aria-hidden />
      )}

      <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-soft">
        {item.type === "reaction" ? (
          <>
            <span className="font-semibold text-ink">{actor ?? "Someone"}</span> reacted{" "}
            <span className="text-base">{item.reaction.emoji}</span>
          </>
        ) : (
          <ActivityText item={item} />
        )}
      </p>

      <time
        className="mt-0.5 shrink-0 text-[11px] tabular-nums text-muted"
        dateTime={new Date(item.ts).toISOString()}
      >
        {timeAgo(item.ts, now)}
      </time>
    </li>
  );
}

/**
 * Structured entries get the actor bolded and the track named; anything from
 * before the server tagged its events — a room persisted across the upgrade —
 * falls back to the sentence the server wrote, which is still correct.
 */
function ActivityText({ item }: { item: Extract<Item, { type: "system" }> }) {
  const { msg, kind } = item;
  const who = <span className="font-semibold text-ink">{msg.actor}</span>;
  const what = msg.track ? <span className="text-ink">{msg.track.title}</span> : null;

  if (kind === "joined" && msg.actor) return <>{who} joined the room</>;
  if (kind === "left" && msg.actor) return <>{who} left</>;
  if (kind === "queued" && msg.actor && what) return <>{who} queued {what}</>;
  if (kind === "dj" && msg.actor && what) return <>{who} put on {what}</>;
  return <>{msg.text}</>;
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(ActivityFeed);
