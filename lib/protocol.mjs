// Shared realtime protocol between the Socket.io server and browser clients.
// Keep this framework-free so both server.mjs and the React client can import it.

export const EVENTS = {
  // client -> server
  JOIN: "join",
  QUEUE_ADD: "queue:add",
  QUEUE_REMOVE: "queue:remove",
  QUEUE_LIKE: "queue:like",
  QUEUE_VOTE: "queue:vote",
  QUEUE_REORDER: "queue:reorder",
  CONTROL_SKIP: "control:skip",
  CONTROL_PLAYPAUSE: "control:playpause",
  CONTROL_SEEK: "control:seek",
  CONTROL_SHUFFLE: "control:shuffle",
  CONTROL_REPEAT: "control:repeat",
  VOTE_SKIP: "vote:skip",
  CHAT_SEND: "chat:send",
  REACTION: "reaction",
  PRESENCE_SET: "presence:set",
  SYNC_PING: "sync:ping",
  TRACK_ENDED: "track:ended",

  // server -> client
  ROOM_STATE: "room:state",
  QUEUE_UPDATE: "queue:update",
  PLAYBACK_UPDATE: "playback:update",
  PARTICIPANTS_UPDATE: "participants:update",
  HISTORY_UPDATE: "history:update",
  STATS_UPDATE: "stats:update",
  MOOD_UPDATE: "mood:update",
  CHAT_NEW: "chat:new",
  /**
   * The DJ is composing. People announce this through their own presence
   * status; the DJ has no socket and no seat, so the server says it on the
   * DJ's behalf around the calls that take a second or two.
   */
  DJ_TYPING: "dj:typing",
  REACTION_NEW: "reaction:new",
  SYNC_PONG: "sync:pong",
  DOWNLOAD_PROGRESS: "download:progress",
  ERROR: "sw:error",
};

/**
 * Emoji a listener can fling into the room, each paired with the animation it
 * plays. The style is part of the protocol rather than a client-side lookup so
 * that every client in the room draws the same gesture the same way — a burst
 * one person sees as confetti is confetti for everyone.
 */
export const REACTIONS = [
  { emoji: "❤️", style: "hearts", label: "Love it" },
  { emoji: "🔥", style: "sparks", label: "This goes hard" },
  { emoji: "👏", style: "confetti", label: "Applause" },
  { emoji: "😂", style: "bounce", label: "Funny" },
  { emoji: "✨", style: "sparkles", label: "Beautiful" },
  { emoji: "🎉", style: "confetti", label: "Celebrate" },
];

/** Emoji → animation style, for reactions arriving off the wire. */
export const REACTION_STYLES = Object.fromEntries(
  REACTIONS.map((r) => [r.emoji, r.style])
);

/** Fraction of votes needed to skip the current track. */
export const SKIP_THRESHOLD = 0.5;

/**
 * What someone in the room is doing right now.
 *
 * Everything except `reconnecting` is reported by the client, because the
 * client is the only thing that knows whether a text field has focus or a tab
 * has been in the background for a minute. `reconnecting` is the server's, and
 * is the reason a dropped socket doesn't immediately read as "left".
 */
export const STATUSES = [
  "listening",
  "typing",
  "queueing",
  "voting",
  "afk",
  "reconnecting",
];

/** How long a dropped socket keeps its seat before the room says they left. */
export const RECONNECT_GRACE_MS = 12_000;

/**
 * Room moods, in priority order. `match` is evaluated against a small signal
 * summary (see moodFor) — first match wins, and `listening` is the floor.
 *
 * Deliberately rule-based and readable rather than clever: the badge tells
 * people what the room "feels like", and a mood nobody can explain is worse
 * than no mood at all. Each carries `why` so the UI can say what it saw.
 */
export const MOODS = [
  {
    id: "party",
    emoji: "🔥",
    label: "Party",
    why: "lots of reactions and chat",
    match: (s) => s.reactionRate >= 3 && s.chatRate >= 2,
  },
  {
    id: "gaming",
    emoji: "🎮",
    label: "Gaming",
    why: "steady chat, nobody skipping",
    match: (s) => s.chatRate >= 3 && s.skipRate < 0.5,
  },
  {
    id: "melancholy",
    emoji: "💔",
    label: "Melancholy",
    why: "hearts, and a quiet room",
    match: (s) => s.heartShare >= 0.6 && s.chatRate < 1,
  },
  {
    id: "latenight",
    emoji: "🌙",
    label: "Late Night",
    why: "it's late where this room lives",
    match: (s) => s.hour >= 23 || s.hour < 5,
  },
  {
    id: "study",
    emoji: "📚",
    label: "Study",
    why: "long tracks, almost no chatter",
    match: (s) => s.chatRate < 0.5 && s.reactionRate < 0.5 && s.avgTrackSec > 240,
  },
  {
    id: "chill",
    emoji: "😌",
    label: "Chill",
    why: "ticking along quietly",
    match: () => true,
  },
];
