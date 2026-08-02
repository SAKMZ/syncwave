"use client";

import { useEffect, useState } from "react";
import { REACTION_STYLES } from "@/lib/protocol.mjs";
import { seededRandom } from "@/lib/seed";

/**
 * Reactions, as gestures rather than emoji.
 *
 * The server sends one small event per tap; each client blooms it into a burst
 * locally, so a cheering room costs the same bandwidth as a quiet one. The
 * burst is generated from a PRNG seeded with the event's own id, which means
 * every browser in the room draws *the same* burst — same particle count, same
 * drift, same delays — without a byte of it being transmitted.
 *
 * Where a burst starts depends on what it is. Hearts, sparks and sparkles come
 * up from wherever they were let go; confetti and laughter are thrown from the
 * middle, near the reaction bar, because that is where the hand was.
 */

type Particle = {
  id: string;
  emoji: string;
  style: string;
  left: number;
  delay: number;
  drift: number;
  rise: number;
  scale: number;
  spin: number;
};

export type IncomingReaction = { id: string; emoji: string };

const COUNTS: Record<string, [number, number]> = {
  hearts: [4, 6],
  sparks: [8, 12],
  confetti: [12, 18],
  bounce: [3, 4],
  sparkles: [6, 9],
};

/** Longest a burst can be on screen, plus slack for the last particle's delay. */
const LIFETIME_MS = 3600;

function burst({ id, emoji }: IncomingReaction): Particle[] {
  const style = REACTION_STYLES[emoji] ?? "hearts";
  const rand = seededRandom(id);
  const [lo, hi] = COUNTS[style] ?? COUNTS.hearts;
  const n = lo + Math.floor(rand() * (hi - lo + 1));
  const centred = style === "confetti" || style === "bounce";

  return Array.from({ length: n }, (_, i) => ({
    id: `${id}-${i}`,
    emoji,
    style,
    left: centred ? 42 + rand() * 16 : 8 + rand() * 84,
    delay: Math.round(i * (centred ? 24 : 70) + rand() * 60),
    drift: Math.round((rand() - 0.5) * (style === "confetti" ? 340 : 110)),
    rise: -(140 + rand() * (style === "sparks" ? 260 : 160)),
    scale: (style === "confetti" || style === "sparks" ? 0.5 : 0.75) + rand() * 0.6,
    spin: Math.round((rand() - 0.5) * (style === "confetti" ? 720 : 60)),
  }));
}

export default function Reactions({ incoming }: { incoming: IncomingReaction | null }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!incoming) return;
    const next = burst(incoming);
    setParticles((cur) => [...cur, ...next]);
    const ids = new Set(next.map((p) => p.id));
    const t = setTimeout(
      () => setParticles((cur) => cur.filter((p) => !ids.has(p.id))),
      LIFETIME_MS
    );
    return () => clearTimeout(t);
  }, [incoming]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden
      // The activity feed carries the same information in text, so there is
      // nothing here for a screen reader to miss.
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className={`sw-fx sw-fx-${p.style} absolute bottom-24 text-3xl`}
          style={
            {
              left: `${p.left}%`,
              "--sw-f-delay": `${p.delay}ms`,
              "--sw-f-drift": `${p.drift}px`,
              "--sw-f-rise": `${p.rise}px`,
              "--sw-f-scale": p.scale,
              "--sw-f-spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
