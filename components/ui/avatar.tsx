"use client";

import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRESENCE } from "@/lib/presence";
import type { PresenceStatus } from "@/lib/types";

/**
 * Nobody in a Syncwave room has an account, so there is no uploaded picture to
 * show. An avatar here is derived entirely from the nickname: same name, same
 * colour and same initials on every screen and in every session, which is what
 * makes a face scannable in the queue, the chat and the activity feed at once.
 *
 * The palette stays inside the app's own ramp — violet through pink — with two
 * supporting hues so a room of six doesn't come out monochrome.
 */
const PALETTE = [
  ["#8b5cf6", "#6d28d9"], // violet
  ["#c084fc", "#7e22ce"], // fuchsia
  ["#ff4d8d", "#be185d"], // pink
  ["#f472b6", "#9d174d"], // rose
  ["#34d399", "#047857"], // emerald
  ["#fbbf24", "#b45309"], // amber
] as const;

function hash(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The pair of stops used for this name's avatar, dot and accent. */
export function nickColors(name: string) {
  return PALETTE[hash(name) % PALETTE.length];
}

/** Single flat colour for this name — presence dots, chat name labels. */
export function nickColor(name: string) {
  return nickColors(name)[0];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  xs: "size-5 text-[8px]",
  sm: "size-6 text-[9px]",
  md: "size-8 text-[11px]",
  lg: "size-10 text-[13px]",
} as const;

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
  name,
  size = "md",
  isHost = false,
  ring = false,
  status,
  className,
}: {
  name: string;
  size?: AvatarSize;
  /** Draws the host crown badge. */
  isHost?: boolean;
  /** Separates overlapping avatars in a stack from whatever is behind them. */
  ring?: boolean;
  /** Draws the presence dot. Omit where presence isn't known or isn't relevant. */
  status?: PresenceStatus;
  className?: string;
}) {
  const [from, to] = nickColors(name);
  const presence = status ? PRESENCE[status] : null;
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full font-bold text-white select-none",
        SIZES[size],
        ring && "ring-2 ring-[color:var(--bg)]",
        // Away and dropped read as receded rather than as a different person.
        presence?.dim && "opacity-60",
        "transition-opacity duration-200 ease-[var(--ease)]",
        className
      )}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
      title={presence ? `${name} · ${presence.short}` : name}
      aria-label={presence ? `${name}, ${presence.label}` : name}
    >
      {initials(name)}
      {isHost && (
        <Crown
          className="absolute -right-0.5 -top-1 size-2.5 text-[#fbbf24] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          aria-label="host"
        />
      )}
      {presence && size !== "xs" && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[color:var(--bg)]",
            size === "lg" ? "size-3" : "size-2.5",
            presence.pulse && "sw-status-pulse"
          )}
          style={{ background: presence.color }}
          aria-hidden
        />
      )}
    </span>
  );
}

/**
 * Overlapping avatars with a "+N" tail. Used in the room header and under the
 * now-playing artwork — the point of the app is that these particular people
 * are hearing this particular moment, so they get shown, not counted.
 */
export function AvatarStack({
  names,
  statuses,
  max = 5,
  size = "md",
  className,
}: {
  names: string[];
  /** Optional nick → status, so the stack shows presence like everywhere else. */
  statuses?: Record<string, PresenceStatus>;
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-2">
        {shown.map((n) => (
          <Avatar key={n} name={n} size={size} ring status={statuses?.[n]} />
        ))}
      </div>
      {rest > 0 && (
        <span
          className={cn(
            "ml-2 grid place-items-center rounded-full border border-white/12 bg-white/8 px-2 font-semibold text-ink-soft",
            size === "lg" ? "h-10 text-xs" : size === "md" ? "h-8 text-[11px]" : "h-6 text-[10px]"
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
