"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PresenceStatus } from "@/lib/types";

/** Idle this long with the tab in front and you're marked away. */
const AFK_AFTER_MS = 90_000;
/** A transient status decays back to listening on its own. */
const TRANSIENT_MS = 4_000;

/**
 * Reports what this listener is doing.
 *
 * The server can only see packets, so anything about intent — a text field
 * with focus, a search box mid-word, a tab that's been in the background for a
 * minute and a half — has to be observed here and sent. The server owns
 * exactly one status, `reconnecting`, because that's the one thing the client
 * can't report about itself.
 *
 * Everything is deduplicated before it goes out: a status is only sent when it
 * differs from the last one sent, so holding a key down doesn't turn into a
 * packet per keystroke.
 */
export function usePresence(send: (status: PresenceStatus) => void, enabled: boolean) {
  const sent = useRef<PresenceStatus | null>(null);
  const lastActive = useRef(Date.now());
  const decayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  const push = useCallback(
    (status: PresenceStatus) => {
      if (!enabled || sent.current === status) return;
      sent.current = status;
      sendRef.current(status);
    },
    [enabled]
  );

  /**
   * Signal a transient status. It reverts to `listening` on its own after a
   * few quiet seconds — calling this repeatedly (as typing does) just pushes
   * the reversion out, so one send covers a whole sentence.
   */
  const signal = useCallback(
    (status: PresenceStatus) => {
      lastActive.current = Date.now();
      push(status);
      if (decayTimer.current) clearTimeout(decayTimer.current);
      decayTimer.current = setTimeout(() => push("listening"), TRANSIENT_MS);
    },
    [push]
  );

  // Away, by two routes: the tab is hidden, or nobody has touched anything in
  // a while. The second is what catches a laptop left open in another room.
  useEffect(() => {
    if (!enabled) return;

    const touch = () => {
      lastActive.current = Date.now();
      if (sent.current === "afk" && document.visibilityState === "visible") push("listening");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") push("afk");
      else touch();
    };

    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActive.current > AFK_AFTER_MS) push("afk");
    }, 15_000);

    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(id);
      if (decayTimer.current) clearTimeout(decayTimer.current);
    };
  }, [enabled, push]);

  return signal;
}
