"use client";

import { Play, Pause, SkipForward, Loader2, Disc3 } from "lucide-react";

type Track = {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
} | null;

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function Eq({ playing }: { playing: boolean }) {
  return (
    <span className={`sw-eq ${playing ? "" : "paused"}`} aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export default function Player({
  current,
  isPlaying,
  position,
  duration,
  isHost,
  downloadPct,
  buffering,
  skipVotes,
  needVotes,
  onPlayPause,
  onSkip,
  onSeek,
  onVoteSkip,
}: {
  current: Track;
  isPlaying: boolean;
  position: number;
  duration: number;
  isHost: boolean;
  downloadPct: number | null;
  buffering: boolean;
  skipVotes: number;
  needVotes: number;
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (pos: number) => void;
  onVoteSkip: () => void;
}) {
  const dur = duration || current?.duration || 0;
  const pct = dur ? Math.min(100, (position / dur) * 100) : 0;
  const loading = buffering || downloadPct != null;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHost || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(((e.clientX - rect.left) / rect.width) * dur);
  };

  return (
    <div className="sw-glass-strong p-6">
      <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
        <Disc3 className={`size-3.5 ${isPlaying ? "sw-spin" : "sw-spin paused"}`} /> Now Playing
        {current && <Eq playing={isPlaying} />}
      </div>

      {current ? (
        <>
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div
                className={`relative size-28 overflow-hidden rounded-2xl ${isPlaying ? "sw-glow" : ""}`}
              >
                {current.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.thumbnail} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center bg-field">
                    <Disc3 className="size-10 text-muted" />
                  </div>
                )}
                {loading && (
                  <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
                    <Loader2 className="size-7 animate-spin text-white" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-2xl font-bold text-ink">
                {current.title}
              </div>
              <div className="truncate text-base text-ink/60">{current.artist}</div>
              {downloadPct != null && downloadPct < 100 && (
                <div className="mt-1.5 text-xs font-medium text-accent-2">
                  Buffering — {downloadPct}%
                </div>
              )}
            </div>
          </div>

          {/* progress */}
          <div className="mt-6">
            <div
              className={`group relative h-2.5 w-full rounded-full bg-white/8 ${isHost ? "cursor-pointer" : ""}`}
              onClick={seek}
            >
              <div className="sw-accent-bar absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%` }} />
              <div
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_12px_rgba(139,92,255,0.9)] transition-opacity group-hover:opacity-100"
                style={{ left: `${pct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs text-ink/50">
              <span>{fmt(position)}</span>
              <span>{fmt(dur)}</span>
            </div>
          </div>

          {/* controls */}
          <div className="mt-5 flex items-center gap-3">
            {isHost ? (
              <>
                <button
                  onClick={onPlayPause}
                  className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[#6b3ff0] text-white shadow-[0_8px_30px_-6px_var(--accent)] transition-transform hover:scale-105 active:scale-95"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 translate-x-0.5" />}
                </button>
                <button
                  onClick={onSkip}
                  className="grid size-10 place-items-center rounded-full border border-white/12 text-ink/80 transition-colors hover:bg-white/8 hover:text-ink"
                  aria-label="Skip"
                >
                  <SkipForward className="size-4" />
                </button>
              </>
            ) : (
              <button
                onClick={onVoteSkip}
                className="flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-white/8"
              >
                <SkipForward className="size-4" /> Vote skip ({skipVotes}/{needVotes})
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-4 py-4 text-ink/50">
          <div className="grid size-16 place-items-center rounded-2xl bg-white/5">
            <Disc3 className="size-7" />
          </div>
          <p>Nothing playing — add a song to start the jam.</p>
        </div>
      )}
    </div>
  );
}
