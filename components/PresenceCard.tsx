"use client";

import { useMemo } from "react";
import { Crown, ListPlus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRESENCE, since } from "@/lib/presence";
import type { Participant } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";

/**
 * The profile behind an avatar.
 *
 * Everything on it is something the room already knows about this person —
 * when they arrived, what they've queued, what they react with. Nothing is
 * collected for the card's sake, which is why there's no bio and no history of
 * what they've listened to elsewhere.
 */
export function PresenceCard({ p }: { p: Participant }) {
  const presence = PRESENCE[p.status] ?? PRESENCE.listening;

  // Their three most-used reactions, biggest first. A person's reaction habit
  // is oddly recognisable, and it's the one playful thing on the card.
  const favourites = useMemo(
    () =>
      Object.entries(p.reactions ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [p.reactions]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={p.nick} size="lg" isHost={p.isHost} status={p.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{p.nick}</span>
            {p.isHost && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em] text-[#fbbf24] uppercase">
                <Crown className="size-2.5" /> Host
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs">
            <span
              className={cn("size-1.5 rounded-full", presence.pulse && "sw-status-pulse")}
              style={{ background: presence.color }}
              aria-hidden
            />
            <span style={{ color: presence.color }}>{presence.short}</span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat icon={<ListPlus className="size-3" />} value={p.songsAdded ?? 0} label="queued" />
        <Stat icon={<MessageSquare className="size-3" />} value={p.messages ?? 0} label="said" />
        <Stat value={since(p.joinedAt)} label="here" />
      </dl>

      {favourites.length > 0 && (
        <div>
          <div className="sw-label mb-2 text-[10px]">Reacts with</div>
          <ul className="flex flex-wrap gap-1.5">
            {favourites.map(([emoji, count]) => (
              <li
                key={emoji}
                className="flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.04] py-1 pl-2 pr-2.5 text-xs"
              >
                <span aria-hidden>{emoji}</span>
                <span className="tabular-nums text-muted">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="sw-card px-2 py-2">
      <dd className="flex items-center justify-center gap-1 text-sm font-semibold text-ink">
        {icon}
        <span className="tabular-nums">{value}</span>
      </dd>
      <dt className="mt-0.5 text-[10px] tracking-[0.12em] text-muted uppercase">{label}</dt>
    </div>
  );
}

/** An avatar that opens its own profile. The default way to render a person. */
export function PresenceAvatar({
  p,
  size = "sm",
  withName = false,
  className,
}: {
  p: Participant;
  size?: "xs" | "sm" | "md" | "lg";
  withName?: boolean;
  className?: string;
}) {
  return (
    <Popover
      label={`${p.nick} — profile`}
      align="start"
      width={252}
      buttonClassName={cn(
        "flex items-center gap-2 rounded-full transition-[background-color,transform] duration-200 ease-[var(--ease)] hover:bg-white/8 active:scale-95",
        withName && "min-w-0 max-w-full py-1 pl-1 pr-3",
        className
      )}
      button={
        <>
          <Avatar name={p.nick} size={size} isHost={p.isHost} status={p.status} />
          {withName && <span className="truncate text-xs text-ink-soft">{p.nick}</span>}
        </>
      }
    >
      <PresenceCard p={p} />
    </Popover>
  );
}
