"use client";

import { useRef } from "react";

/**
 * Horizontal swipe between panes, for the phone's tab bar.
 *
 * Touch events rather than pointer events here on purpose: the queue's drag
 * handle already captures the pointer, and a swipe that competes with a
 * reorder is worse than no swipe. Touch also lets a vertical scroll win
 * cleanly — if the finger has travelled further down than across, this is a
 * scroll and we stay out of it.
 */
export function useSwipe(
  onSwipe: (direction: 1 | -1) => void,
  { threshold = 64, enabled = true } = {}
) {
  const start = useRef<{ x: number; y: number } | null>(null);

  if (!enabled) return {};

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      onSwipe(dx < 0 ? 1 : -1);
    },
  };
}
