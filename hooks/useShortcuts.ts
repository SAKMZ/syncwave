"use client";

import { useEffect, useRef } from "react";
import { matchShortcut, type ShortcutId } from "@/lib/shortcuts";

/**
 * True when the keystroke belongs to something the user is writing in.
 *
 * Without this, typing "queue" in chat opens the queue four times and sends
 * "ueue". Covers the obvious fields plus contenteditable, and treats any
 * element that has opted into its own key handling (`data-keys="own"`) as
 * off-limits too.
 */
function isTyping(target: EventTarget | null) {
  // Not every keydown target is an Element — a synthetic event dispatched on
  // `window` or `document` reaches here too, and calling `closest` on one of
  // those throws inside the listener, which silently kills every shortcut.
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (target as HTMLElement).isContentEditable ||
    target.closest("[data-keys='own']") != null
  );
}

/**
 * Global keyboard shortcuts.
 *
 * Escape is the exception to the typing guard: it is how you get *out* of a
 * field, so it has to be heard while one has focus.
 */
export function useShortcuts(handlers: Partial<Record<ShortcutId, () => void>>) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const id = matchShortcut(e);
      if (!id) return;
      if (id !== "close" && isTyping(e.target)) return;

      const fn = ref.current[id];
      if (!fn) return;
      // Space scrolls, / opens Firefox quick-find, ? does nothing useful —
      // claim the key only once we know something is listening for it.
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
