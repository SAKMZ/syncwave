"use client";

import { useEffect, useState } from "react";

/**
 * Chromecast/AirPlay via the browser's own Remote Playback API — no server or
 * protocol involvement, same category as local volume.
 *
 * Best-effort: the sync loop's 0.75s hard-correction may fight a cast
 * target's own relay latency, which is harmless if audible, since local
 * output isn't what's playing on the connected device.
 *
 * `getElement` is a getter rather than a fixed ref because crossfade swaps
 * which of the two `<audio>` elements is authoritative. It must be a stable
 * `useCallback` that changes identity when the active element does — the
 * listener effect keys off it, so a getter that never changes identity would
 * leave this watching an element the room has already retired, reporting a
 * cast session that ended (or missing one that started).
 */
export function useCasting(getElement: () => HTMLAudioElement | null) {
  const [supported, setSupported] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setSupported(typeof HTMLMediaElement !== "undefined" && "remote" in HTMLMediaElement.prototype);
  }, []);

  useEffect(() => {
    if (!supported) return;
    const remote = getElement()?.remote;
    if (!remote) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    remote.addEventListener("connect", onConnect);
    remote.addEventListener("disconnect", onDisconnect);
    // Adopt whatever this element's state already is: after a slot flip the
    // events that would have told us fired on the other element.
    setConnected(remote.state === "connected");
    return () => {
      remote.removeEventListener("connect", onConnect);
      remote.removeEventListener("disconnect", onDisconnect);
    };
  }, [supported, getElement]);

  const prompt = () => {
    getElement()?.remote?.prompt().catch(() => {});
  };

  return { supported, connected, prompt };
}
