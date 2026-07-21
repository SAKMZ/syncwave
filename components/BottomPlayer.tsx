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
  Smile,
} from "lucide-react";
import { REACTIONS } from "@/lib/protocol.mjs";

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
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (pos: number) => void;
  onVoteSkip: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onReact: (emoji: string) => void;
}) {
  const [reactOpen, setReactOpen] = useState(false);
  const dur = duration || current?.duration || 0;
  const cachePct = downloadPct ?? 0;
  const playPct = dur ? Math.min(100, (position / dur) * 100) : 0;
  const loading = preparing || buffering;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHost || !dur || preparing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(((e.clientX - rect.left) / rect.width) * dur);
  };

  const react = (emoji: string) => {
    onReact(emoji);
    setReactOpen(false);
  };

  return (
    <footer className="relative z-40 shrink-0 border-t border-white/10 bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
      {/* seek / progress line spanning the whole bar */}
      <div
        className={`group relative h-1 w-full bg-white/10 ${isHost && !preparing ? "cursor-pointer" : ""}`}
        onClick={seek}
      >
        <div
          className={`sw-accent-bar absolute inset-y-0 left-0 ${preparing ? "transition-[width] duration-300" : ""}`}
          style={{ width: `${preparing ? cachePct : playPct}%` }}
        />
        {isHost && !preparing && (
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_10px_var(--accent)] transition-opacity group-hover:opacity-100"
            style={{ left: `${playPct}%` }}
          />
        )}
      </div>

      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4">
        {/* now playing */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-lg sm:size-12">
            {current?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.thumbnail} alt="" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center bg-white/5">
                <Disc3 className="size-5 text-muted" />
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-black/55">
                <Loader2 className="size-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">
              {current ? current.title : "Nothing playing"}
            </div>
            <div className="truncate text-xs text-muted">
              {preparing
                ? cachePct >= 100
                  ? "Processing audio…"
                  : `Caching audio — ${cachePct}%`
                : current
                  ? current.artist
                  : "Add a song to start"}
            </div>
          </div>
          {/* time (desktop) */}
          {current && !preparing && (
            <div className="hidden shrink-0 font-mono text-xs text-muted md:block">
              {fmt(position)} / {fmt(dur)}
            </div>
          )}
        </div>

        {/* controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <IconToggle
            active={shuffle}
            disabled={!isHost}
            onClick={onShuffle}
            label="Shuffle"
          >
            <Shuffle className="size-4" />
          </IconToggle>

          {isHost ? (
            <button
              onClick={onPlayPause}
              disabled={preparing || !current}
              className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[#6b3ff0] text-white shadow-[0_6px_20px_-6px_var(--accent)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 translate-x-0.5" />}
            </button>
          ) : (
            <button
              onClick={onVoteSkip}
              disabled={!current}
              className="grid size-10 place-items-center rounded-full border border-white/15 text-ink/80 transition-colors hover:bg-white/10 disabled:opacity-40"
              aria-label="Vote to skip"
              title={`Vote skip (${skipVotes}/${needVotes})`}
            >
              <SkipForward className="size-4" />
            </button>
          )}

          {isHost && (
            <button
              onClick={onSkip}
              disabled={!current}
              className="grid size-9 place-items-center rounded-full border border-white/12 text-ink/80 transition-colors hover:bg-white/10 disabled:opacity-40"
              aria-label="Next"
            >
              <SkipForward className="size-4" />
            </button>
          )}

          <IconToggle
            active={repeat !== "off"}
            disabled={!isHost}
            onClick={onRepeat}
            label={`Repeat: ${repeat}`}
          >
            {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
          </IconToggle>

          {/* reactions */}
          <div className="relative">
            <button
              onClick={() => setReactOpen((v) => !v)}
              className="grid size-9 place-items-center rounded-full border border-white/12 text-ink/70 transition-colors hover:bg-white/10 hover:text-ink"
              aria-label="React"
            >
              <Smile className="size-4" />
            </button>
            {reactOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setReactOpen(false)} />
                <div className="absolute bottom-11 right-0 z-50 flex gap-1 rounded-full border border-white/10 bg-[var(--popover)] p-1.5 shadow-xl sw-fade-in">
                  {REACTIONS.map((e: string) => (
                    <button
                      key={e}
                      onClick={() => react(e)}
                      className="grid size-9 place-items-center rounded-full text-lg transition-transform hover:scale-125 active:scale-95"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
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
      className={`relative grid size-9 place-items-center rounded-full transition-colors disabled:opacity-30 ${
        active
          ? "text-[var(--accent-2)] hover:bg-white/10"
          : "text-ink/60 hover:bg-white/10 hover:text-ink"
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-0.5 size-1 rounded-full bg-[var(--accent-2)]" />
      )}
    </button>
  );
}
