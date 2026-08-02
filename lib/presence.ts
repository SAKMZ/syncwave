import type { PresenceStatus } from "@/lib/types";

/**
 * How each presence status looks and reads.
 *
 * One table rather than a switch at each call site, because the same status
 * appears on an avatar dot, in a profile card and in the listener list, and
 * the three must never disagree. Colours come from the palette — nothing here
 * introduces a hue the rest of the app doesn't already use.
 */
export const PRESENCE: Record<
  PresenceStatus,
  { label: string; short: string; color: string; pulse: boolean; dim: boolean }
> = {
  listening: {
    label: "Listening",
    short: "Listening",
    color: "var(--success)",
    pulse: false,
    dim: false,
  },
  typing: {
    label: "Typing a message",
    short: "Typing…",
    color: "var(--accent-2)",
    pulse: true,
    dim: false,
  },
  queueing: {
    label: "Looking for a song",
    short: "Queueing",
    color: "var(--accent)",
    pulse: true,
    dim: false,
  },
  voting: {
    label: "Voting",
    short: "Voting",
    color: "var(--accent-3)",
    pulse: true,
    dim: false,
  },
  afk: { label: "Away", short: "Away", color: "var(--muted)", pulse: false, dim: true },
  reconnecting: {
    label: "Reconnecting",
    short: "Reconnecting…",
    color: "#fbbf24",
    pulse: true,
    dim: true,
  },
};

/** Short human duration — "just now", "12m", "3h". */
export function since(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
