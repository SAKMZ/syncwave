"use client";

import { useEffect, useState } from "react";

/**
 * Chromecast/AirPlay via the browser's own Remote Playback API — no server or
 * protocol involvement, same category as local volume.
 *
 * Best-effort for v1: a couple of rough edges are accepted rather than solved
 * here. The sync loop's 0.75s hard-correction may fight a cast target's own
 * relay latency (harmless, if audible, since it's not what's actually playing
 * on the connected device); and if a crossfade-driven flip hands control to
 * the *other* `<audio>` element while a cast session is live, the session
 * stays bound to the element it was started on — casting a track through to
 * its natural end and then letting it crossfade into the next one may need
 * the cast re-started, since `remote.prompt()` needs a fresh user gesture and
 * can't silently follow the flip.
 *
 * `getElement` is a getter rather than a fixed ref so `prompt()` always binds
 * to whichever element is active *right now*, not whichever was active when
 * this hook first rendered.
 */
export function useCasting(getElement: () => HTMLAudioElement | null) {
  const [supported, setSupported] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setSupported(typeof HTMLMediaElement !== "undefined" && "remote" in HTMLMediaElement.prototype);
  }, []);

  useEffect(() => {
    if (!supported) return;
    const el = getElement();
    const remote = el?.remote;
    if (!remote) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    remote.addEventListener("connect", onConnect);
    remote.addEventListener("disconnect", onDisconnect);
    return () => {
      remote.removeEventListener("connect", onConnect);
      remote.removeEventListener("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const prompt = () => {
    getElement()?.remote?.prompt().catch(() => {});
  };

  return { supported, connected, prompt };
}
