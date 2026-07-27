"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Loader2,
  Disc3,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { REACTIONS } from "@/lib/protocol.mjs";
import { cn } from "@/lib/cn";

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

export default function BottomPlayer({
  current,
  isPlaying,
  position,
  duration,
  isHost,
  downloadPct,
  buffering,
  preparing,
  shuffle,
  repeat,
  skipVotes,
  needVotes,
  volume,
  onVolume,
  onPlayPause,
  onSkip,
  onSeek,
  onVoteSkip,
  onShuffle,
  onRepeat,
  onReact,
}: {
  current: Track;
  isPlaying: boolean;
  position: number;
  duration: number;
  isHost: boolean;
  downloadPct: number | null;
  buffering: boolean;
  preparing: boolean;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  skipVotes: number;
  needVotes: number;
  volume: number;
  onVolume: (v: number) => void;
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (pos: number) => void;
  onVoteSkip: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onReact: (emoji: string) => void;
}) {
  const dur = duration || current?.duration || 0;
  const cachePct = downloadPct ?? 0;
  const playPct = dur ? Math.min(100, (position / dur) * 100) : 0;
  const loading = preparing || buffering;
  const canSeek = isHost && dur > 0 && !preparing;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * dur);
  };

  const status = preparing
    ? cachePct >= 100
      ? "Processing audio…"
      : `Caching audio — ${cachePct}%`
    : buffering
      ? "Buffering…"
      : current?.artist;

  return (
    <footer className="relative z-40 shrink-0 border-t border-white/10 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-2xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4 md:px-5 md:py-3">
        {/* ── left: track identity ── */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-white/10 sm:size-14">
            {current?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.thumbnail} alt="" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center bg-white/5">
                <Disc3 className="size-5 text-muted" />
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <Loader2 className="size-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">
              {current ? current.title : "Nothing playing"}
            </div>
            <div
              className={cn(
                "truncate text-xs",
                preparing || buffering ? "text-accent-2" : "text-muted"
              )}
            >
              {status ?? "Add a song to start"}
            </div>
          </div>
        </div>

        {/* ── centre: transport + scrubber ── */}
        <div className="order-3 col-span-2 flex flex-col items-center gap-0.5 md:order-none md:col-span-1 md:w-[min(46vw,520px)] md:gap-1">
          <div className="flex items-center gap-1 sm:gap-2">
            <IconToggle active={shuffle} disabled={!isHost} onClick={onShuffle} label="Shuffle">
              <Shuffle className="size-4" />
            </IconToggle>

            {isHost ? (
              <button
                onClick={onPlayPause}
                disabled={preparing || !current}
                className="grid size-11 place-items-center rounded-full bg-white text-[#0b0b12] shadow-[0_4px_18px_-4px_rgba(255,255,255,0.45)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="size-5" fill="currentColor" />
                ) : (
                  <Play className="size-5 translate-x-px" fill="currentColor" />
                )}
              </button>
            ) : (
              <button
                onClick={onVoteSkip}
                disabled={!current}
                className="flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-ink/85 transition-colors hover:bg-white/10 disabled:opacity-30"
                aria-label="Vote to skip"
                title="Vote to skip this track"
              >
                <SkipForward className="size-4" />
                <span className="font-mono text-xs">
                  {skipVotes}/{needVotes}
                </span>
              </button>
            )}

            {isHost && (
              <button
                onClick={onSkip}
                disabled={!current}
                className="grid size-9 place-items-center rounded-full text-ink/70 transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-30"
                aria-label="Next track"
                title="Next track"
              >
                <SkipForward className="size-4" />
              </button>
            )}

            <IconToggle
              active={repeat !== "off"}
              disabled={!isHost}
              onClick={onRepeat}
              label={
                repeat === "one"
                  ? "Repeat: this track"
                  : repeat === "all"
                    ? "Repeat: queue"
                    : "Repeat: off"
              }
            >
              {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
            </IconToggle>
          </div>

          {/* Scrubber. Shows download progress while the track is still caching,
              which is why the room isn't playing yet. */}
          <div className="flex w-full items-center gap-2">
            <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
              {fmt(position)}
            </span>
            <div
              className={cn("sw-seek flex-1", !canSeek && "cursor-default")}
              onClick={seek}
              role={canSeek ? "slider" : undefined}
              aria-label={canSeek ? "Seek" : undefined}
              aria-valuemin={canSeek ? 0 : undefined}
              aria-valuemax={canSeek ? Math.round(dur) : undefined}
              aria-valuenow={canSeek ? Math.round(position) : undefined}
              tabIndex={canSeek ? 0 : undefined}
              onKeyDown={(e) => {
                if (!canSeek) return;
                if (e.key === "ArrowRight") onSeek(Math.min(dur, position + 5));
                if (e.key === "ArrowLeft") onSeek(Math.max(0, position - 5));
              }}
            >
              <div className="sw-seek-track">
                {preparing && <div className="sw-seek-buffer" style={{ width: `${cachePct}%` }} />}
                <div className="sw-seek-fill" style={{ width: `${preparing ? 0 : playPct}%` }} />
              </div>
              {canSeek && <div className="sw-seek-thumb" style={{ left: `${playPct}%` }} />}
            </div>
            <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-muted">
              {fmt(dur)}
            </span>
          </div>
        </div>

        {/* ── right: volume, plus reactions where there's room for them ── */}
        <div className="flex items-center justify-end gap-1">
          <Volume volume={volume} onVolume={onVolume} />
          <ReactionBar onReact={onReact} className="hidden md:flex" />
        </div>

        {/* On a phone the top row is already full, so the reactions get their
            own line rather than being hidden behind a button. */}
        <ReactionBar onReact={onReact} className="order-4 col-span-2 justify-center md:hidden" />
      </div>
    </footer>
  );
}

/**
 * Reactions, always visible. They used to live behind a smiley: tap to open,
 * tap to react, popover closes — so cheering three times cost six taps and the
 * moment had passed. One tap is the whole interaction now.
 */
function ReactionBar({
  onReact,
  className,
}: {
  onReact: (emoji: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {REACTIONS.map((e: string) => (
        <button
          key={e}
          onClick={() => onReact(e)}
          className="grid size-8 shrink-0 place-items-center rounded-full text-base transition-transform hover:scale-125 hover:bg-white/10 active:scale-90"
          aria-label={`React ${e}`}
          title={`React ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

/**
 * Local volume. Deliberately not synced to the room: playback position is shared
 * so everyone hears the same moment, but how loud it is belongs to the listener.
 * Muting remembers the previous level so unmuting restores it.
 */
function Volume({ volume, onVolume }: { volume: number; onVolume: (v: number) => void }) {
  const [last, setLast] = useState(volume || 1);
  const muted = volume === 0;

  const toggle = () => {
    if (muted) {
      onVolume(last || 1);
    } else {
      setLast(volume);
      onVolume(0);
    }
  };

  const Icon = muted ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      <button
        onClick={toggle}
        className="grid size-9 place-items-center rounded-full text-ink/65 transition-colors hover:bg-white/10 hover:text-ink"
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
      >
        <Icon className="size-4" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onVolume(Number(e.target.value))}
        className="sw-range w-20"
        aria-label="Volume"
        title={`Volume ${Math.round(volume * 100)}%`}
      />
    </div>
  );
}

// Toggleable icon button (shuffle / repeat) — accent-tinted when active.
function IconToggle({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "relative grid size-9 place-items-center rounded-full transition-colors disabled:opacity-25",
        active ? "text-[var(--accent-2)] hover:bg-white/10" : "text-ink/60 hover:bg-white/10 hover:text-ink"
      )}
    >
      {children}
      {active && <span className="absolute bottom-0.5 size-1 rounded-full bg-[var(--accent-2)]" />}
    </button>
  );
}
