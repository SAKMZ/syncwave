"use client";

import { useState } from "react";
import {
  Heart,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { REACTIONS } from "@/lib/protocol.mjs";
import { cn } from "@/lib/cn";
import type { Repeat as RepeatMode, Track } from "@/lib/types";
import { CountButton, Cover } from "@/components/ui/track-row";

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
  likes,
  liked,
  onLike,
  onVolume,
  onPlayPause,
  onSkip,
  onSeek,
  onVoteSkip,
  onShuffle,
  onRepeat,
  onReact,
}: {
  current: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isHost: boolean;
  downloadPct: number | null;
  buffering: boolean;
  preparing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  skipVotes: number;
  needVotes: number;
  volume: number;
  likes: number;
  liked: boolean;
  onLike: () => void;
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
    <footer className="relative z-40 shrink-0 border-t border-white/8 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-2xl">
      {/* A hairline of the current track's colour across the whole bar — the
          quietest possible way to tie the player to what is playing. */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: "linear-gradient(90deg, transparent, var(--art-1), var(--art-2), transparent)" }}
        aria-hidden
      />

      {/* Tighter on a phone: the bar is two rows there, and every pixel it
          takes comes out of the panel above it. */}
      <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6 md:px-6 md:py-3">
        {/* ── left: track identity ── */}
        <div className="flex min-w-0 items-center gap-3">
          <Cover src={current?.thumbnail} size="md" className="sm:size-14">
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <Loader2 className="size-5 animate-spin text-white" />
              </div>
            )}
            {isPlaying && !loading && (
              <div className="absolute inset-x-0 bottom-0 grid h-5 place-items-center bg-gradient-to-t from-black/75 to-transparent">
                <span className="sw-eq h-2.5" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </Cover>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">
              {current ? current.title : "Nothing playing"}
            </div>
            <div
              className={cn(
                "truncate text-xs",
                preparing || buffering ? "text-[var(--accent-2)]" : "text-muted"
              )}
            >
              {status ?? "Add a song to start"}
            </div>
          </div>
          {current && (
            <CountButton
              icon={<Heart className={cn("size-3.5", liked && "fill-current")} />}
              count={likes}
              active={liked}
              tone="pink"
              label={liked ? "Unlike this track" : "Like this track"}
              onClick={onLike}
            />
          )}
        </div>

        {/* ── centre: transport + scrubber ── */}
        <div className="order-3 col-span-2 flex flex-col items-center gap-1 md:order-none md:col-span-1 md:w-[min(46vw,560px)] md:gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <IconToggle active={shuffle} disabled={!isHost} onClick={onShuffle} label="Shuffle">
              <Shuffle className="size-4" />
            </IconToggle>

            {isHost ? (
              <button
                onClick={onPlayPause}
                disabled={preparing || !current}
                className={cn(
                  "grid size-11 place-items-center rounded-full text-white md:size-12",
                  "bg-[image:linear-gradient(135deg,var(--art-1),var(--art-2))]",
                  "shadow-[0_8px_28px_-8px_var(--art-1)]",
                  "transition-[transform,box-shadow,opacity] duration-200 ease-[var(--ease)]",
                  "hover:scale-105 hover:shadow-[0_10px_36px_-8px_var(--art-1)] active:scale-95",
                  "disabled:opacity-30 disabled:hover:scale-100"
                )}
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
                className="flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 md:h-12 text-sm font-semibold text-ink/85 transition-[background-color,border-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:bg-white/10 active:translate-y-0 disabled:opacity-30"
                aria-label="Vote to skip"
                title="Vote to skip this track"
              >
                <SkipForward className="size-4" />
                <span className="font-mono text-xs tabular-nums">
                  {skipVotes}/{needVotes}
                </span>
              </button>
            )}

            {isHost && (
              <button
                onClick={onSkip}
                disabled={!current}
                className="grid size-9 place-items-center rounded-full text-ink/70 transition-[background-color,color,transform] duration-200 ease-[var(--ease)] hover:bg-white/10 hover:text-ink active:scale-95 disabled:opacity-30"
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
          <div className="flex w-full items-center gap-3">
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

        {/* ── right: reactions and volume ── */}
        <div className="flex items-center justify-end gap-2">
          <ReactionBar onReact={onReact} className="hidden lg:flex" />
          <span className="hidden h-6 w-px bg-white/8 lg:block" aria-hidden />
          <Volume volume={volume} onVolume={onVolume} />
        </div>
      </div>

    </footer>
  );
}

/**
 * Reactions, always visible. They used to live behind a smiley: tap to open,
 * tap to react, popover closes — so cheering three times cost six taps and the
 * moment had passed. One tap is the whole interaction now.
 *
 * Exported because on a phone it is rendered outside the player, floating just
 * above the tab bar: both belong in the same band of screen the thumb can
 * actually reach without the hand moving.
 */
export function ReactionBar({
  onReact,
  className,
}: {
  onReact: (emoji: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {REACTIONS.map(({ emoji, label }: { emoji: string; label: string }) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="grid size-8 shrink-0 place-items-center rounded-full text-base transition-[transform,background-color] duration-200 ease-[var(--ease)] hover:scale-125 hover:bg-white/10 active:scale-90"
          aria-label={label}
          title={label}
        >
          {emoji}
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
    <div className="hidden items-center gap-2 sm:flex">
      <button
        onClick={toggle}
        className="grid size-9 place-items-center rounded-full text-ink/65 transition-[background-color,color] duration-200 ease-[var(--ease)] hover:bg-white/10 hover:text-ink"
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
        "relative grid size-9 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-[var(--ease)] active:scale-95 disabled:opacity-25",
        active
          ? "text-[var(--accent-2)] hover:bg-white/10"
          : "text-ink/60 hover:bg-white/10 hover:text-ink"
      )}
    >
      {children}
      {active && <span className="absolute bottom-0.5 size-1 rounded-full bg-[var(--accent-2)]" />}
    </button>
  );
}
