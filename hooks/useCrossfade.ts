"use client";

import { useCallback, useRef } from "react";

/**
 * The volume-ramp math for a crossfade, kept out of Room so the orchestration
 * there (when to start, which element is which, when to adopt the result)
 * stays readable on its own. This hook only knows how to fade one element's
 * volume down and another's up over a fixed duration — it has no opinion
 * about audio position, the server clock, or anything else.
 */
export function useCrossfade() {
  const frameRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const start = useCallback(
    (
      from: HTMLAudioElement,
      to: HTMLAudioElement,
      seconds: number,
      targetVolume: number,
      onDone?: () => void
    ) => {
      cancel();
      const fromStart = from.volume;
      const begin = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - begin) / (seconds * 1000));
        from.volume = fromStart * (1 - t);
        to.volume = targetVolume * t;
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          frameRef.current = null;
          onDone?.();
        }
      };
      frameRef.current = requestAnimationFrame(step);
    },
    [cancel]
  );

  return { start, cancel };
}
