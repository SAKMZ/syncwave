"use client";

import { useMemo } from "react";
import { Disc3, Heart, Loader2, Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Participant, Track } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/panel";
import { CountButton } from "@/components/ui/track-row";
import { PresenceAvatar } from "@/components/PresenceCard";

/**
 * The artwork-forward hero, and the room's centre of gravity. Everything here
 * is tinted by the cover itself through --art-1/--art-2, so the column reads as
 * belonging to whatever is playing rather than to the app chrome.
 */

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Deterministic PRNG so a track's waveform is the same shape every render. */
function seeded(seed: string, count: number) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const r = ((h ^= h >>> 16) >>> 0) / 4294967296;
    // Bias towards the middle of the range and give the ends a taper, so it
    // reads as a waveform rather than as a bar chart of noise.
    const taper = Math.sin((i / (count - 1)) * Math.PI) * 0.35 + 0.65;
    bars.push((0.22 + r * 0.78) * taper);
  }
  return bars;
}

const BARS = 64;

/**
 * The waveform doubles as the scrubber. It is decorative — Syncwave never has
 * the decoded audio on the client, so there is nothing real to draw — but it is
 * stable per track, which is what stops it reading as an animation loop.
 */
function Waveform({
  seed,
  progress,
  playing,
  canSeek,
  onSeek,
}: {
  seed: string;
  /** 0–1 */
  progress: number;
  playing: boolean;
  canSeek: boolean;
  onSeek: (ratio: number) => void;
}) {
  const bars = useMemo(() => seeded(seed, BARS), [seed]);
  const played = Math.round(progress * BARS);

  return (
    <div
      className={cn("sw-wave sw-focus", playing && "sw-wave-playing", canSeek && "cursor-pointer")}
      role={canSeek ? "slider" : undefined}
      aria-label={canSeek ? "Seek" : undefined}
      aria-valuemin={canSeek ? 0 : undefined}
      aria-valuemax={canSeek ? 100 : undefined}
      aria-valuenow={canSeek ? Math.round(progress * 100) : undefined}
      tabIndex={canSeek ? 0 : undefined}
      onClick={(e) => {
        if (!canSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
      }}
      onKeyDown={(e) => {
        if (!canSeek) return;
        if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.02));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.02));
      }}
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className={i < played ? "text-[var(--art-1)]" : "text-white/25"}
          style={{
            height: `${Math.round(h * 100)}%`,
            // A late bar shouldn't animate in lockstep with an early one.
            animationDelay: `${(i % 8) * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function NowPlaying({
  current,
  isPlaying,
  preparing,
  cachePct,
  buffering,
  participants,
  position,
  likes,
  liked,
  onLike,
  canSeek,
  onSeek,
  className,
}: {
  current: Track | null;
  isPlaying: boolean;
  preparing: boolean;
  cachePct: number;
  buffering: boolean;
  participants: Participant[];
  position: number;
  /** Nicknames who've liked the current track. */
  likes: string[];
  liked: boolean;
  onLike: () => void;
  canSeek: boolean;
  onSeek: (seconds: number) => void;
  className?: string;
}) {
  const loading = preparing || buffering;
  const dur = current?.duration ?? 0;
  const progress = dur > 0 ? Math.min(1, position / dur) : 0;

  return (
    // min-h-0 is load-bearing: a flex child defaults to min-height:auto, so
    // `flex-1` alone won't let this shrink below its content and it renders
    // straight through the player instead. With it, the panel is bounded and
    // scrolls internally on a short screen rather than escaping.
    // `safe center` rather than plain centring: once the content is taller than
    // the panel, ordinary centring overflows in both directions and hides the
    // top with no way to scroll back to it. `safe` falls back to top-aligned
    // exactly then, so a crowded room degrades instead of losing the artwork.
    <section
      className={cn(
        "sw-panel sw-scroll flex min-h-0 flex-col overflow-y-auto p-4 sm:p-6 [justify-content:safe_center]",
        className
      )}
    >
      {/* No listener count here. The top bar carries the avatar stack at every
          width, and this panel lists everyone in full further down — a third
          copy of the same fact was what made the old panel feel crowded. */}
      <SectionHeader icon={<Radio className="size-3.5" />} title="Now playing" />

      {/* Artwork. The glow lives on the wrapper because .sw-art clips overflow. */}
      <div
        className={cn(
          // Capped by viewport height as well as width, so on a short phone the
          // cover gives way rather than shoving everything below it off-screen.
          "sw-art-glow mx-auto aspect-square w-full max-w-[min(300px,30vh)] shrink-0",
          "[@media(max-height:720px)]:max-w-[170px]",
          isPlaying && !loading && "sw-art-playing"
        )}
      >
        <div className="sw-art size-full">
          {current?.art || current?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              // Keyed on the track so React remounts it and the fade actually
              // runs — otherwise the src swaps in place and the cover pops.
              key={current.videoId}
              src={current.art || current.thumbnail}
              alt={`${current.title} cover art`}
              // Deliberately NOT crossOrigin: colour sampling uses its own
              // request (see useArtworkTheme) so that a host which stops
              // sending CORS headers costs us the tint, not the cover.
              className="sw-art-in size-full object-cover"
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
      <div className="mt-6 min-w-0 text-center">
        {current ? (
          <>
            <h2
              className="truncate font-display text-xl font-bold leading-snug text-ink"
              title={current.title}
            >
              {current.title}
            </h2>
            <p className="mt-1 truncate text-sm text-ink-soft" title={current.artist}>
              {current.artist}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              {current.addedBy && (
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                  <Avatar name={current.addedBy} size="xs" />
                  <span className="truncate">added by {current.addedBy}</span>
                </span>
              )}
              <CountButton
                icon={<Heart className={cn("size-3.5", liked && "fill-current")} />}
                count={likes.length}
                active={liked}
                tone="pink"
                label={
                  likes.length
                    ? `${liked ? "Unlike" : "Like"} — liked by ${likes.join(", ")}`
                    : "Like this track"
                }
                onClick={onLike}
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold text-ink">Nothing playing</h2>
            <p className="mt-1 text-sm text-muted">Add a song to get the room started.</p>
          </>
        )}
      </div>

      {/* The phone's stand-in for the waveform — a sign of life that reads
          instantly as "audio" and costs one line. */}
      {current && (
        <div className="mt-5 flex justify-center md:hidden">
          <span className={cn("sw-eq", !isPlaying && "paused")} aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>
      )}

      {/* Waveform + elapsed. Doubles as the host's scrubber.
          Desktop only: on a phone this panel and the player's own scrubber are
          a hundred pixels apart, and the height it costs is the height the
          artwork needs to stay the focal point. */}
      {current && (
        <div className="mt-6 hidden shrink-0 md:block">
          <Waveform
            seed={current.videoId}
            progress={progress}
            playing={isPlaying && !loading}
            canSeek={canSeek}
            onSeek={(ratio) => onSeek(ratio * dur)}
          />
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] tabular-nums text-muted">
            <span>{fmt(position)}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
      )}

      {/* Who's here. The point of the app is that these people hear the same
          thing at the same moment, so it's worth showing rather than counting.
          Desktop only: on a phone the header already lists everyone, and
          repeating it here costs the room's scarcest resource, vertical space.
          Deliberately not mt-auto — pinning to the bottom works on a tall
          screen, but once the panel scrolls it pins to the bottom of the
          *scrollable* content and the listeners leave the viewport. */}
      <div className="hidden pt-8 xl:block">
        <div className="sw-label mb-3">Listening together</div>
        {/* Each one opens its own profile — who they are, when they arrived,
            what they've put on. */}
        <ul className="sw-scroll flex max-h-[5.5rem] flex-wrap gap-1.5 overflow-y-auto">
          {participants.map((p) => (
            <li key={p.id} className="min-w-0 max-w-full">
              <PresenceAvatar p={p} size="sm" withName className="border border-white/8 bg-white/[0.04]" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
