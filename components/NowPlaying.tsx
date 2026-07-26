"use client";

import { Crown, Disc3, Loader2, Radio, Users } from "lucide-react";
import { cn } from "@/lib/cn";

type Track = {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
  /** Larger cover for this panel; falls back to the list-sized thumbnail. */
  art?: string;
  addedBy?: string;
} | null;

type Participant = { id: string; nick: string; isHost: boolean };

// Deterministic per-name colour, so a person keeps the same dot every session.
const DOT = ["#8b5cff", "#22d3ee", "#ff4d8d", "#facc15", "#4ade80", "#fb923c"];
function dotColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return DOT[Math.abs(h) % DOT.length];
}

/**
 * The artwork-forward hero. A music app's centre of gravity is the cover, and
 * before this existed the largest artwork anywhere in the room was 44px.
 */
export default function NowPlaying({
  current,
  isPlaying,
  preparing,
  cachePct,
  buffering,
  participants,
  className,
}: {
  current: Track;
  isPlaying: boolean;
  preparing: boolean;
  cachePct: number;
  buffering: boolean;
  participants: Participant[];
  className?: string;
}) {
  const loading = preparing || buffering;

  return (
    <section className={cn("sw-glass flex flex-col p-5", className)}>
      <div className="sw-label mb-4 justify-between">
        <span className="flex items-center gap-2">
          <Radio className="size-3.5" /> Now playing
        </span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <Users className="size-3.5" />
          {participants.length}
        </span>
      </div>

      {/* Artwork. The glow lives on the wrapper because .sw-art clips overflow. */}
      <div
        className={cn(
          "sw-art-glow mx-auto aspect-square w-full max-w-[260px]",
          isPlaying && !loading && "sw-art-playing"
        )}
      >
        <div className="sw-art size-full">
          {current?.art || current?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.art || current.thumbnail}
              alt={`${current.title} cover art`}
              className="size-full object-cover"
              // Old rooms persisted before this field existed only have the
              // small thumbnail; don't leave them with a broken image.
              onError={(e) => {
                const img = e.currentTarget;
                if (current.thumbnail && img.src !== current.thumbnail) {
                  img.src = current.thumbnail;
                }
              }}
            />
          ) : (
            <div className="grid size-full place-items-center bg-white/[0.04]">
              <Disc3 className="size-16 text-white/15" />
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-7 animate-spin text-white" />
                <span className="font-mono text-xs text-white/80">
                  {preparing ? (cachePct >= 100 ? "Processing" : `${cachePct}%`) : "Buffering"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title block */}
      <div className="mt-5 min-w-0 text-center">
        {current ? (
          <>
            <h2
              className="truncate font-display text-lg font-bold leading-snug text-ink"
              title={current.title}
            >
              {current.title}
            </h2>
            <p className="mt-0.5 truncate text-sm text-ink-soft" title={current.artist}>
              {current.artist}
            </p>
            {current.addedBy && (
              <p className="mt-2 truncate text-xs text-muted">added by {current.addedBy}</p>
            )}
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold text-ink">Nothing playing</h2>
            <p className="mt-1 text-sm text-muted">Add a song to get the room started.</p>
          </>
        )}
      </div>

      {/* Live equalizer — a small sign of life that reads instantly as "audio". */}
      {current && (
        <div className="mt-4 flex justify-center">
          <span className={cn("sw-eq", !isPlaying && "paused")} aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>
      )}

      {/* Who's here. The point of the app is that these people hear the same
          thing at the same moment, so it's worth showing rather than a count. */}
      <div className="mt-auto pt-6">
        <div className="sw-label mb-2">Listening</div>
        <ul className="sw-scroll flex max-h-40 flex-col gap-0.5 overflow-y-auto">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-0.5 text-sm">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: dotColor(p.nick) }}
                aria-hidden
              />
              <span className="truncate text-ink-soft">{p.nick}</span>
              {p.isHost && (
                <Crown className="size-3 shrink-0 text-[var(--accent)]" aria-label="host" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
