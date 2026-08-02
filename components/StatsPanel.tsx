"use client";

import { memo } from "react";

import {
  BarChart3,
  Heart,
  ListMusic,
  MessageSquare,
  Music,
  SkipForward,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { RoomStats } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Cover } from "@/components/ui/track-row";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/panel";

/**
 * The session so far.
 *
 * A summary, not a dashboard: six numbers people actually enjoy seeing, plus
 * the two that are about each other rather than about the room — who queued
 * the most, and what everyone liked best. Every figure here is derived from
 * the room's own history, so nothing needs measuring separately.
 */

function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.round(sec)}s`;
}

function StatsPanel({
  stats,
  className,
}: {
  stats: RoomStats | null;
  className?: string;
}) {
  if (!stats) {
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>
        <SectionHeader icon={<BarChart3 className="size-3.5" />} title="This session" />
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="Nothing to count yet"
          hint="Play something and the room starts keeping score."
        />
      </div>
    );
  }

  const started = new Date(stats.since);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <SectionHeader
        icon={<BarChart3 className="size-3.5" />}
        title="This session"
        trailing={
          <span className="text-[11px] text-muted">
            since{" "}
            <time dateTime={started.toISOString()}>
              {started.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </time>
          </span>
        }
      />

      <div className="sw-scroll min-h-0 flex-1 overflow-y-auto">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat icon={<Music className="size-3.5" />} value={stats.songsPlayed} label="songs" />
          <Stat
            icon={<Timer className="size-3.5" />}
            value={duration(stats.listenedSec)}
            label="listened"
          />
          <Stat
            icon={<Users className="size-3.5" />}
            value={stats.listeners}
            label="listeners"
            hint={`${stats.hereNow} here now`}
          />
          <Stat
            icon={<MessageSquare className="size-3.5" />}
            value={stats.messages}
            label="messages"
          />
          <Stat icon={<Sparkles className="size-3.5" />} value={stats.reactions} label="reactions" />
          <Stat icon={<SkipForward className="size-3.5" />} value={stats.skips} label="skips" />
        </dl>

        {(stats.topContributor || stats.mostLiked) && (
          <div className="mt-4 grid gap-2">
            {stats.topContributor && (
              <div className="sw-card sw-card-hover flex items-center gap-3 p-3">
                <Avatar name={stats.topContributor.nick} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="sw-label text-[10px]">
                    <ListMusic className="size-3" /> Top contributor
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-ink">
                    {stats.topContributor.nick}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--accent-2)]">
                  {stats.topContributor.count}
                </span>
              </div>
            )}

            {stats.mostLiked && (
              <div className="sw-card sw-card-hover flex items-center gap-3 p-3">
                <Cover src={stats.mostLiked.thumbnail} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="sw-label text-[10px]">
                    <Heart className="size-3" /> Most liked
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-ink">
                    {stats.mostLiked.title}
                  </div>
                  <div className="truncate text-xs text-muted">{stats.mostLiked.artist}</div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-[var(--accent-3)]">
                  <Heart className="size-3.5 fill-current" />
                  {stats.mostLiked.likes}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  hint,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div className="sw-card px-3 py-3" title={hint}>
      <dd className="flex items-center gap-1.5 font-display text-lg font-bold tabular-nums text-ink">
        <span className="text-[var(--accent-2)]">{icon}</span>
        {value}
      </dd>
      <dt className="mt-1 text-[10px] tracking-[0.14em] text-muted uppercase">{label}</dt>
    </div>
  );
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(StatsPanel);
