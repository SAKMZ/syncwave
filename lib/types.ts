/**
 * Shapes shared between the room components. These mirror what lib/rooms.mjs
 * puts on the wire; keep the two in step.
 */

export type Status = { state: "cached" | "downloading" | "pending"; percent: number };

export type Track = {
  id?: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
  /** Larger cover for the now-playing hero. Absent on pre-existing rooms. */
  art?: string;
  addedBy?: string;
  /** When it was queued. Absent on rooms persisted before the rich queue. */
  addedAt?: number;
  /** Nicknames — the identity model here is the name you typed on the way in. */
  likes?: string[];
  votes?: string[];
  status?: Status;
};

/** What someone is doing. Everything but `reconnecting` is client-reported. */
export type PresenceStatus =
  | "listening"
  | "typing"
  | "queueing"
  | "voting"
  | "afk"
  | "reconnecting";

export type Participant = {
  id: string;
  nick: string;
  isHost: boolean;
  status: PresenceStatus;
  statusAt: number;
  joinedAt: number;
  songsAdded: number;
  messages: number;
  /** emoji → how many times they've sent it. */
  reactions: Record<string, number>;
};

/** What happened, for system entries in the room log. */
export type SystemKind =
  | "joined"
  | "left"
  | "queued"
  | "nowplaying"
  | "skipped"
  | "dj"
  | "error";

export type ChatMsg = {
  id: string;
  ts: number;
  nick?: string;
  text: string;
  system?: boolean;
  dj?: boolean;
  /** Present on system entries written after the activity feed shipped. */
  kind?: SystemKind;
  /** Who did it, for system entries that have a person behind them. */
  actor?: string;
  /** The track a `queued` / `nowplaying` / `dj` entry is about. */
  track?: { title: string; artist: string; thumbnail?: string };
};

/** Reactions are never persisted, so they only exist in the live session. */
export type ReactionEvent = { id: string; emoji: string; nick?: string; ts: number };

export type HistoryEntry = {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
  art?: string;
  duration: number;
  addedBy?: string;
  likes: string[];
  playedAt: number;
  /** How much of it the room actually heard. */
  playedSec: number;
  skipped: boolean;
};

export type RoomStats = {
  since: number;
  songsPlayed: number;
  listenedSec: number;
  /** Everyone seen this session, not just who is here now. */
  listeners: number;
  hereNow: number;
  messages: number;
  reactions: number;
  skips: number;
  topContributor: { nick: string; count: number } | null;
  mostLiked: { title: string; artist: string; thumbnail?: string; likes: number } | null;
};

export type Mood = { id: string; emoji: string; label: string; why: string };

export type Repeat = "off" | "one" | "all";

/* --- search ------------------------------------------------------------- */

export type SearchType = "songs" | "albums" | "artists";

export type AlbumResult = {
  albumId: string;
  title: string;
  artist: string;
  year: number | null;
  thumbnail?: string;
};

export type ArtistResult = {
  artistId: string;
  name: string;
  thumbnail?: string;
};

export type AlbumDetail = AlbumResult & { tracks: Track[] };
