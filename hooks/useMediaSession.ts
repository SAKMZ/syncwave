"use client";

import { useEffect } from "react";
import type { Track } from "@/lib/types";

/**
 * Lock-screen / notification media controls.
 *
 * Read-only against the server clock: this only ever reports the position the
 * room already computed (via `position`/`isPlaying`, both already reactive
 * state in Room), it never touches `audio.currentTime` itself. Play/pause/seek
 * route through the same `emit(EVENTS.CONTROL_*)` calls the on-screen controls
 * use, so the server stays the sole source of truth either way.
 *
 * Non-host listeners can't control playback in the room UI today, so their
 * lock-screen buttons are disabled the same way — a stray tap from a pocket or
 * a locked phone shouldn't be able to do anything a tap in the room couldn't.
 */
export function useMediaSession({
  current,
  isPlaying,
  position,
  duration,
  isHost,
  onPlayPause,
  onSkip,
  onSeek,
}: {
  current: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isHost: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (position: number) => void;
}) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    if (!current) {
      session.metadata = null;
      return;
    }
    session.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      artwork: current.art || current.thumbnail ? [{ src: current.art || current.thumbnail! }] : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.videoId, current?.title, current?.artist, current?.art, current?.thumbnail]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = current ? (isPlaying ? "playing" : "paused") : "none";
  }, [current, isPlaying]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!current || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(Math.max(0, position), duration),
        playbackRate: 1,
      });
    } catch {
      // Some browsers throw if position momentarily exceeds duration (a track
      // ending mid-tick) — the next tick corrects it, nothing to do here.
    }
  }, [current, position, duration]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    session.setActionHandler("play", isHost ? onPlayPause : null);
    session.setActionHandler("pause", isHost ? onPlayPause : null);
    session.setActionHandler("nexttrack", isHost ? onSkip : null);
    session.setActionHandler("seekto", isHost ? (details) => onSeek(details.seekTime ?? 0) : null);

    return () => {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
      session.setActionHandler("nexttrack", null);
      session.setActionHandler("seekto", null);
    };
  }, [isHost, onPlayPause, onSkip, onSeek]);
}
