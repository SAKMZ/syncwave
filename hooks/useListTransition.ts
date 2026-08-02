"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps removed items around long enough to animate them out.
 *
 * Entering is easy — a new node can animate on mount. Leaving is the hard half:
 * by the time React knows an item is gone it has already unmounted, so the row
 * vanishes instantly while everything below it snaps up. That is exactly what
 * happens every time a track leaves the queue to start playing, which is the
 * single most-watched transition in the app.
 *
 * So: hold the departed items in place, flagged, for one animation, then drop
 * them. Deliberately not a dependency — this is the whole of what
 * AnimatePresence would be used for here, and the room's list animations are
 * not worth forty kilobytes of animation runtime.
 *
 * @returns the items to render, each tagged with whether it is on its way out.
 */
export function useListTransition<T>(
  items: T[],
  keyOf: (item: T) => string,
  durationMs = 260
): { item: T; key: string; exiting: boolean }[] {
  const [exiting, setExiting] = useState<{ item: T; key: string }[]>([]);
  const prev = useRef<Map<string, T>>(new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const next = new Map(items.map((i) => [keyOf(i), i]));
    const gone: { item: T; key: string }[] = [];

    for (const [key, item] of prev.current) {
      if (next.has(key) || timers.current.has(key)) continue;
      gone.push({ item, key });
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          setExiting((cur) => cur.filter((e) => e.key !== key));
        }, durationMs)
      );
    }

    // An item that comes back before its exit finishes (a re-add, a reorder
    // that briefly drops it) should stop leaving rather than animate out from
    // underneath its own new row.
    for (const key of next.keys()) {
      const t = timers.current.get(key);
      if (!t) continue;
      clearTimeout(t);
      timers.current.delete(key);
      setExiting((cur) => cur.filter((e) => e.key !== key));
    }

    if (gone.length) setExiting((cur) => [...cur, ...gone]);
    prev.current = next;
  }, [items, keyOf, durationMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
    };
  }, []);

  return [
    ...items.map((item) => ({ item, key: keyOf(item), exiting: false })),
    ...exiting.map((e) => ({ ...e, exiting: true })),
  ];
}
