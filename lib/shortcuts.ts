/**
 * The room's keyboard map, in one place so the help dialog can't drift from
 * what actually happens. `keys` is what's printed; `match` is what's checked.
 */
export type ShortcutId =
  | "playpause"
  | "prev"
  | "next"
  | "search"
  | "queue"
  | "chat"
  | "history"
  | "like"
  | "mute"
  | "help"
  | "close";

export type Shortcut = {
  id: ShortcutId;
  keys: string[];
  label: string;
  /** Only the host can drive playback; the rest apply to everyone. */
  hostOnly?: boolean;
  group: "Playback" | "Navigate" | "Room";
};

export const SHORTCUTS: Shortcut[] = [
  { id: "playpause", keys: ["Space"], label: "Play / pause", hostOnly: true, group: "Playback" },
  { id: "prev", keys: ["J"], label: "Back 10 seconds", hostOnly: true, group: "Playback" },
  { id: "next", keys: ["L"], label: "Next track", hostOnly: true, group: "Playback" },
  { id: "mute", keys: ["M"], label: "Mute / unmute", group: "Playback" },
  { id: "search", keys: ["/", "⌘K"], label: "Search", group: "Navigate" },
  { id: "queue", keys: ["Q"], label: "Queue", group: "Navigate" },
  { id: "chat", keys: ["C"], label: "Chat", group: "Navigate" },
  { id: "history", keys: ["H"], label: "History", group: "Navigate" },
  { id: "like", keys: ["F"], label: "Like the current track", group: "Room" },
  { id: "help", keys: ["?"], label: "This list", group: "Room" },
  { id: "close", keys: ["Esc"], label: "Close whatever is open", group: "Room" },
];

/**
 * `J` is back and `L` is forward because that is what every video player on
 * the web has trained people to expect, and `J` seeking rather than jumping
 * tracks is the same convention — there is no previous track in a shared queue
 * that has already consumed it.
 */
export function matchShortcut(e: KeyboardEvent): ShortcutId | null {
  if (e.metaKey || e.ctrlKey || e.altKey) {
    // ⌘K is the one modified binding, and it's handled by the search field
    // itself so the shortcut works whether or not the room has focus.
    return null;
  }
  switch (e.key) {
    case " ":
    case "Spacebar":
      return "playpause";
    case "j":
    case "J":
      return "prev";
    case "l":
    case "L":
      return "next";
    case "/":
      return "search";
    case "q":
    case "Q":
      return "queue";
    case "c":
    case "C":
      return "chat";
    case "h":
    case "H":
      return "history";
    case "f":
    case "F":
      return "like";
    case "m":
    case "M":
      return "mute";
    case "?":
      return "help";
    case "Escape":
      return "close";
    default:
      return null;
  }
}
