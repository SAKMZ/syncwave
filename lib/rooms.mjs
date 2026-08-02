// In-memory room store (persisted to disk) + Socket.io wiring.
// The SERVER owns the playback clock; clients render their <audio> position
// from `startedAt`, so everyone stays in sync. Rooms are durable: they survive
// an empty room and a server restart (permanent links). Ownership is by a
// durable ownerToken the creator holds in localStorage.

import { customAlphabet } from "nanoid";
import {
  EVENTS,
  MOODS,
  RECONNECT_GRACE_MS,
  SKIP_THRESHOLD,
  STATUSES,
} from "./protocol.mjs";
import { prefetchAudio, ensureAudio, touchCache, cacheStatus } from "./resolver.mjs";
import { loadSync, saveDebounced } from "./store.mjs";
import { searchSongs } from "./ytmusic.mjs";
import { djEnabled, generateIntro, interpretRequest, djName } from "./dj.mjs";

/**
 * Playback time, on a clock that only ever moves forward.
 *
 * `startedAt` and the `serverNow` clients calibrate against have to advance at
 * the same rate and never jump. `Date.now()` does jump: an NTP correction, a
 * VM suspend and resume, or someone fixing the server's timezone steps it by
 * whatever the drift was. Every listener derives its audio position from those
 * two numbers, so a step doesn't desync one client — it yanks the entire room
 * at once, mid-song.
 *
 * The wall-clock anchor is taken once at boot purely so the values still look
 * like timestamps on the wire. Nothing downstream depends on them matching
 * real time, only on the difference between them being honest. Rooms restore
 * with `startedAt: 0`, so these never have to survive a restart.
 */
const WALL_AT_BOOT = Date.now();
const MONO_AT_BOOT = performance.now();
const monoNow = () => WALL_AT_BOOT + (performance.now() - MONO_AT_BOOT);

const genCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);
const genToken = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 24);

/** How much of the room's past it remembers. Bounded — this is all in memory. */
const HISTORY_MAX = 120;
/** Window the mood is inferred over. */
const MOOD_WINDOW_MS = 10 * 60 * 1000;

/** @type {Map<string, any>} */
const rooms = (globalThis.__SW_ROOMS ??= new Map());

/** Empty session counters. Reset per process, not per room lifetime. */
function freshSession() {
  return {
    startedAt: Date.now(),
    messages: 0,
    reactions: 0,
    skips: 0,
    /** Every nickname seen this session, so "listeners" isn't just who's here now. */
    seen: new Set(),
    /** Rolling signal log for the mood. Trimmed to MOOD_WINDOW_MS on read. */
    recentReactions: [],
    recentSkips: [],
  };
}

// Rehydrate durable rooms once at startup.
if (!globalThis.__SW_ROOMS_LOADED) {
  globalThis.__SW_ROOMS_LOADED = true;
  const saved = loadSync("rooms", {});
  for (const [code, r] of Object.entries(saved)) {
    rooms.set(code, {
      code,
      name: r.name || `Room ${code}`,
      ownerToken: r.ownerToken || null,
      createdAt: r.createdAt || Date.now(),
      hostId: null,
      participants: new Map(),
      queue: (r.queue || []).map(normalizeItem),
      history: r.history || [],
      current: null,
      startedAt: 0,
      isPlaying: false,
      preparing: false,
      playToken: 0,
      pausedPosition: 0,
      shuffle: r.shuffle || false,
      repeat: r.repeat || "off",
      skipVotes: new Set(),
      chat: [],
      mood: null,
      session: freshSession(),
    });
  }
}

/**
 * Bring a queue item up to the current shape. Rooms persisted before likes and
 * votes existed replay with neither, and every read site would otherwise need
 * its own `?? []`.
 */
function normalizeItem(t) {
  return {
    ...t,
    addedAt: t.addedAt ?? Date.now(),
    likes: Array.isArray(t.likes) ? t.likes : [],
    votes: Array.isArray(t.votes) ? t.votes : [],
  };
}

function persist() {
  const out = {};
  for (const [code, r] of rooms) {
    // Persist the upcoming list (with current re-queued at front so nothing is lost).
    const queue = [r.current, ...r.queue].filter(Boolean);
    out[code] = {
      code,
      name: r.name,
      ownerToken: r.ownerToken,
      createdAt: r.createdAt,
      shuffle: r.shuffle,
      repeat: r.repeat,
      queue,
      history: r.history.slice(-HISTORY_MAX),
    };
  }
  saveDebounced("rooms", out);
}

export function createRoom(name) {
  const code = genCode();
  const ownerToken = genToken();
  const room = {
    code,
    name: name || `Room ${code}`,
    ownerToken,
    createdAt: Date.now(),
    hostId: null,
    participants: new Map(),
    queue: [],
    history: [],
    current: null,
    startedAt: 0,
    isPlaying: false,
    preparing: false,
    playToken: 0,
    pausedPosition: 0,
    shuffle: false,
    repeat: "off",
    skipVotes: new Set(),
    chat: [],
    mood: null,
    session: freshSession(),
  };
  rooms.set(code, room);
  persist();
  return room;
}

export function getRoom(code) {
  return rooms.get(code);
}

/* ------------------------------------------------------------------ state */

function queueWithStatus(room) {
  return room.queue.map((t) => ({ ...t, status: cacheStatus(t.videoId) }));
}

/** Where the current track is, in seconds, whether it's running or paused. */
function elapsed(room) {
  if (!room.current) return 0;
  if (room.preparing) return 0;
  return room.isPlaying ? (monoNow() - room.startedAt) / 1000 : room.pausedPosition;
}

/**
 * A summary of the session so far.
 *
 * Derived on read rather than kept as running totals: the inputs (history,
 * counters) are small and bounded, and a derived number can't drift out of
 * step with the thing it describes.
 */
function roomStats(room) {
  const s = room.session;
  const played = room.history;

  const listenedSec =
    played.reduce((n, h) => n + (h.playedSec || 0), 0) + elapsed(room);

  const byContributor = new Map();
  for (const h of played) {
    if (!h.addedBy) continue;
    byContributor.set(h.addedBy, (byContributor.get(h.addedBy) || 0) + 1);
  }
  let topContributor = null;
  for (const [nick, count] of byContributor) {
    if (!topContributor || count > topContributor.count) topContributor = { nick, count };
  }

  let mostLiked = null;
  for (const h of played) {
    const likes = h.likes?.length || 0;
    if (likes > 0 && (!mostLiked || likes > mostLiked.likes)) {
      mostLiked = { title: h.title, artist: h.artist, thumbnail: h.thumbnail, likes };
    }
  }

  return {
    since: s.startedAt,
    songsPlayed: played.length,
    listenedSec: Math.round(listenedSec),
    listeners: s.seen.size,
    hereNow: [...room.participants.values()].filter((p) => p.status !== "reconnecting").length,
    messages: s.messages,
    reactions: s.reactions,
    skips: s.skips,
    topContributor,
    mostLiked,
  };
}

/**
 * What the room feels like right now.
 *
 * Rule-based on purpose — see MOODS. The signals are all rates over the last
 * ten minutes so a burst an hour ago doesn't hold the room hostage.
 */
function moodFor(room) {
  const now = Date.now();
  const cutoff = now - MOOD_WINDOW_MS;
  const mins = MOOD_WINDOW_MS / 60000;

  const reactions = room.session.recentReactions.filter((r) => r.ts >= cutoff);
  const skips = room.session.recentSkips.filter((ts) => ts >= cutoff);
  const chats = room.chat.filter((m) => !m.system && m.ts >= cutoff);
  const recentTracks = room.history.slice(-5);

  const hearts = reactions.filter((r) => r.emoji === "❤️").length;

  const signals = {
    reactionRate: reactions.length / mins,
    chatRate: chats.length / mins,
    skipRate: skips.length / mins,
    heartShare: reactions.length ? hearts / reactions.length : 0,
    avgTrackSec: recentTracks.length
      ? recentTracks.reduce((n, t) => n + (t.duration || 0), 0) / recentTracks.length
      : 0,
    hour: new Date().getHours(),
  };

  const hit = MOODS.find((m) => m.match(signals)) ?? MOODS[MOODS.length - 1];
  return { id: hit.id, emoji: hit.emoji, label: hit.label, why: hit.why };
}

/**
 * What a participant looks like on the wire.
 *
 * Whitelisted rather than spread, because everything on this object is walked
 * by the socket.io encoder before it goes out. Anything not JSON — a timer, a
 * socket, a stream — is a live crash rather than a stray field: the encoder
 * recurses through it looking for binary, and Node's internals are full of
 * circular references, so it never comes back.
 */
function publicParticipant(p) {
  return {
    id: p.id,
    nick: p.nick,
    isHost: p.isHost,
    status: p.status,
    statusAt: p.statusAt,
    joinedAt: p.joinedAt,
    songsAdded: p.songsAdded,
    messages: p.messages,
    reactions: p.reactions,
  };
}

function publicState(room, socketId) {
  return {
    code: room.code,
    name: room.name,
    queue: queueWithStatus(room),
    participants: [...room.participants.values()].map(publicParticipant),
    history: room.history.slice(-HISTORY_MAX),
    stats: roomStats(room),
    mood: room.mood,
    current: room.current,
    startedAt: room.startedAt,
    isPlaying: room.isPlaying,
    preparing: room.preparing,
    pausedPosition: room.pausedPosition,
    shuffle: room.shuffle,
    repeat: room.repeat,
    serverNow: monoNow(),
    skipVotes: room.skipVotes.size,
    you: socketId,
    aiDj: djEnabled() ? djName() : null,
  };
}

/* -------------------------------------------------------------- broadcast */

function broadcastPlayback(io, room) {
  io.to(room.code).emit(EVENTS.PLAYBACK_UPDATE, {
    current: room.current,
    startedAt: room.startedAt,
    isPlaying: room.isPlaying,
    preparing: room.preparing,
    pausedPosition: room.pausedPosition,
    shuffle: room.shuffle,
    repeat: room.repeat,
    serverNow: monoNow(),
    skipVotes: room.skipVotes.size,
  });
}
function broadcastQueue(io, room) {
  io.to(room.code).emit(EVENTS.QUEUE_UPDATE, { queue: queueWithStatus(room) });
}
function broadcastParticipants(io, room) {
  io.to(room.code).emit(EVENTS.PARTICIPANTS_UPDATE, {
    participants: [...room.participants.values()].map(publicParticipant),
  });
}
function broadcastHistory(io, room) {
  io.to(room.code).emit(EVENTS.HISTORY_UPDATE, { history: room.history.slice(-HISTORY_MAX) });
}

/**
 * Stats change on nearly every event, and nobody needs them at 60Hz. One
 * broadcast per room per two seconds is plenty for a summary panel, and it
 * keeps a busy room from spending its bandwidth on its own scoreboard.
 */
const statsTimers = new Map();

/**
 * socket id → the timer holding that seat during the reconnect grace period.
 * Kept here and not on the participant, which is broadcast verbatim.
 */
const dropTimers = new Map();

function broadcastStats(io, room) {
  if (statsTimers.has(room.code)) return;
  statsTimers.set(
    room.code,
    setTimeout(() => {
      statsTimers.delete(room.code);
      io.to(room.code).emit(EVENTS.STATS_UPDATE, { stats: roomStats(room) });
    }, 2000)
  );
}

/**
 * Say whether the DJ is composing.
 *
 * Tracked per room so a late `false` from an abandoned call can't switch off an
 * indicator a newer call turned on, and cleared on a timer as a backstop: a
 * process that dies mid-generation would otherwise leave every client in the
 * room believing the DJ is still typing, with nothing left alive to say
 * otherwise.
 */
const djTypingTimers = new Map();
function djTyping(io, room, on) {
  clearTimeout(djTypingTimers.get(room.code));
  djTypingTimers.delete(room.code);
  if (on) {
    djTypingTimers.set(
      room.code,
      setTimeout(() => {
        djTypingTimers.delete(room.code);
        io.to(room.code).emit(EVENTS.DJ_TYPING, { typing: false, nick: djName() });
      }, 30_000)
    );
  }
  io.to(room.code).emit(EVENTS.DJ_TYPING, { typing: on, nick: djName() });
}

/** Recompute the mood, and tell the room only when it actually changed. */
function refreshMood(io, room) {
  const next = moodFor(room);
  if (room.mood?.id === next.id) return;
  room.mood = next;
  io.to(room.code).emit(EVENTS.MOOD_UPDATE, { mood: next });
}

/**
 * Append to the room log and broadcast it.
 *
 * A message is either something a person (or the DJ) said, or something that
 * happened. The second kind carries `kind` and usually `actor` so the client
 * can render it as an event — icon, avatar, timestamp — instead of parsing the
 * sentence back out of `text`. `text` stays authoritative either way: rooms
 * persisted before `kind` existed replay fine, they just render generically.
 */
function pushChat(io, room, msg) {
  const entry = { id: crypto.randomUUID(), ts: Date.now(), ...msg };
  room.chat.push(entry);
  if (room.chat.length > 200) room.chat.shift();
  io.to(room.code).emit(EVENTS.CHAT_NEW, entry);
}

// Warm a track and stream its download progress to the room.
function warm(io, room, videoId) {
  prefetchAudio(videoId, (pct) => {
    io.to(room.code).emit(EVENTS.DOWNLOAD_PROGRESS, { videoId, percent: pct });
  });
}

// Pull the next track off the queue — random position when shuffle is on.
function pickNext(room) {
  if (!room.queue.length) return null;
  if (room.shuffle) {
    const i = Math.floor(Math.random() * room.queue.length);
    return room.queue.splice(i, 1)[0];
  }
  return room.queue.shift();
}

/**
 * File the track that just finished into the room's history.
 *
 * `skipped` is inferred rather than passed around: a track that leaves with
 * more than five seconds left on it did not end on its own, whoever cut it
 * short. The likes it collected travel with it, which is what makes "most
 * liked song" answerable at the end of a session.
 */
function recordHistory(io, room, { skipped }) {
  const t = room.current;
  if (!t) return;
  const playedSec = Math.max(0, Math.min(t.duration || 0, elapsed(room)));
  room.history.push({
    id: crypto.randomUUID(),
    videoId: t.videoId,
    title: t.title,
    artist: t.artist,
    thumbnail: t.thumbnail,
    art: t.art,
    duration: t.duration,
    addedBy: t.addedBy,
    likes: t.likes || [],
    playedAt: Date.now(),
    playedSec: Math.round(playedSec),
    skipped,
  });
  if (room.history.length > HISTORY_MAX) room.history.shift();
  if (skipped) {
    room.session.skips += 1;
    room.session.recentSkips.push(Date.now());
  }
  broadcastHistory(io, room);
  broadcastStats(io, room);
  refreshMood(io, room);
}

async function playNext(io, room, { fromEnd = false } = {}) {
  room.skipVotes.clear();

  // Repeat-one: a track that ends on its own just replays (no re-cache needed).
  // An explicit skip (fromEnd=false) bypasses this and moves on.
  if (fromEnd && room.repeat === "one" && room.current) {
    recordHistory(io, room, { skipped: false });
    room.playToken++;
    room.startedAt = monoNow();
    room.isPlaying = true;
    room.preparing = false;
    broadcastPlayback(io, room);
    persist();
    return;
  }

  if (room.current) {
    // Five seconds of slack: a track that runs out doesn't always fire its
    // `ended` handler at exactly its stated duration.
    const left = (room.current.duration || 0) - elapsed(room);
    recordHistory(io, room, { skipped: !fromEnd && left > 5 });
  }

  // Repeat-all: send the track we're leaving to the back of the queue.
  if (room.repeat === "all" && room.current) {
    room.queue.push({ ...room.current, likes: [], votes: [], addedAt: Date.now() });
  }

  const next = pickNext(room);
  if (!next) {
    room.current = null;
    room.isPlaying = false;
    room.preparing = false;
    room.startedAt = 0;
    room.pausedPosition = 0;
    room.playToken++;
    broadcastQueue(io, room);
    broadcastPlayback(io, room);
    persist();
    return;
  }

  // Enter a "preparing" state: the track is current but the shared clock has
  // NOT started, so the progress bar stays put while the audio caches. A token
  // lets a later skip/track supersede this preparation.
  const token = ++room.playToken;
  room.current = next;
  room.isPlaying = false;
  room.preparing = true;
  room.startedAt = 0;
  room.pausedPosition = 0;
  touchCache(next.videoId, { title: next.title, artist: next.artist });
  broadcastQueue(io, room);
  broadcastPlayback(io, room);
  persist();

  // Warm the following track in the background so it's ready when we advance.
  if (room.queue[0]) warm(io, room, room.queue[0].videoId);

  // Fully cache the current track BEFORE starting playback.
  try {
    await ensureAudio(next.videoId, (pct) => {
      if (room.playToken === token) {
        io.to(room.code).emit(EVENTS.DOWNLOAD_PROGRESS, { videoId: next.videoId, percent: pct });
      }
    });
  } catch {
    if (room.playToken === token) {
      pushChat(io, room, {
        system: true,
        kind: "error",
        text: `Couldn't load "${next.title}" — skipping.`,
      });
      playNext(io, room);
    }
    return;
  }

  // A newer skip/vote started another track while we were caching — abandon.
  if (room.playToken !== token) return;

  // Audio is ready: start the shared clock now.
  room.startedAt = monoNow();
  room.isPlaying = true;
  room.preparing = false;
  io.to(room.code).emit(EVENTS.DOWNLOAD_PROGRESS, { videoId: next.videoId, percent: 100 });
  broadcastQueue(io, room);
  broadcastPlayback(io, room);
  persist();

  if (djEnabled()) {
    // An LLM takes a second or two, and a room that has just changed track and
    // then sits silent reads as a DJ that has nothing to say. Say it's writing.
    djTyping(io, room, true);
    generateIntro(next, { mood: room.mood })
      .then((intro) => {
        if (intro) pushChat(io, room, { nick: djName(), dj: true, text: intro });
      })
      .finally(() => djTyping(io, room, false));
  } else {
    pushChat(io, room, {
      system: true,
      kind: "nowplaying",
      // Carried so the client can draw the cover instead of repeating the
      // title as prose in the middle of the conversation.
      track: { title: next.title, artist: next.artist, thumbnail: next.thumbnail },
      text: `Now playing: ${next.title} — ${next.artist}`,
    });
  }
}

/** Add a track to the back of the queue. Shared by people, the DJ and re-adds. */
function enqueue(io, room, track, addedBy) {
  const item = normalizeItem({ ...track, id: crypto.randomUUID(), addedBy, addedAt: Date.now() });
  room.queue.push(item);
  warm(io, room, item.videoId);
  broadcastQueue(io, room);
  persist();
  return item;
}

async function handleDjRequest(io, room, text, requester) {
  // One try/finally around the whole thing. Every early return in here is a
  // normal outcome — the message wasn't a request, the search found nothing —
  // and an indicator that survives any of them stays on forever, which is a
  // worse lie than never showing one.
  djTyping(io, room, true);
  try {
    const query = await interpretRequest(text, { mood: room.mood });
    if (!query) return;
    const results = await searchSongs(query, 1);
    const top = results[0];
    if (!top) return;
    enqueue(io, room, top, djName());
    pushChat(io, room, {
      nick: djName(),
      dj: true,
      text: `On it, ${requester} — queuing "${top.title}" by ${top.artist}.`,
    });
    pushChat(io, room, {
      system: true,
      kind: "dj",
      actor: djName(),
      track: { title: top.title, artist: top.artist, thumbnail: top.thumbnail },
      text: `${djName()} queued ${top.title}`,
    });
    if (!room.current) playNext(io, room);
  } catch {
    /* ignore DJ failures */
  } finally {
    djTyping(io, room, false);
  }
}

/* --------------------------------------------------------------- handlers */

export function registerRoomHandlers(io) {
  io.on("connection", (socket) => {
    let joinedCode = null;

    socket.on(EVENTS.JOIN, ({ code, nick, ownerToken }) => {
      const room = rooms.get(code);
      if (!room) {
        socket.emit(EVENTS.ERROR, { message: "Room not found." });
        return;
      }
      joinedCode = room.code;
      const name = nick || "guest";
      const isHost = Boolean(ownerToken && ownerToken === room.ownerToken);
      if (isHost) room.hostId = socket.id;

      // Someone dropping off wifi and coming back should not read to the room
      // as a departure and an arrival. If a seat is still being held for this
      // name, take it back — counters and join time included.
      let carried = null;
      for (const [id, p] of room.participants) {
        if (p.nick === name && p.status === "reconnecting") {
          carried = p;
          clearTimeout(dropTimers.get(id));
          dropTimers.delete(id);
          room.participants.delete(id);
          break;
        }
      }

      room.participants.set(socket.id, {
        id: socket.id,
        nick: name,
        isHost,
        status: "listening",
        statusAt: Date.now(),
        joinedAt: carried?.joinedAt ?? Date.now(),
        songsAdded: carried?.songsAdded ?? 0,
        messages: carried?.messages ?? 0,
        reactions: carried?.reactions ?? {},
      });
      room.session.seen.add(name);

      socket.join(room.code);
      if (!room.mood) room.mood = moodFor(room);
      socket.emit(EVENTS.ROOM_STATE, { ...publicState(room, socket.id), chat: room.chat });
      broadcastParticipants(io, room);
      broadcastStats(io, room);
      if (!carried) {
        pushChat(io, room, {
          system: true,
          kind: "joined",
          actor: name,
          text: `${name} joined`,
        });
      }
      // Resume a persisted queue on first presence.
      if (!room.current && room.queue.length) playNext(io, room);
    });

    const inRoom = () => rooms.get(joinedCode);
    const host = () => {
      const room = inRoom();
      return room && room.participants.get(socket.id)?.isHost ? room : null;
    };
    const me = () => inRoom()?.participants.get(socket.id) ?? null;

    /**
     * Any deliberate action means the person is here and not typing, so it
     * clears whatever transient status they were showing. Saves the client
     * from having to send a "never mind" after every interaction.
     */
    const active = (room) => {
      const p = room?.participants.get(socket.id);
      if (!p || p.status === "listening" || p.status === "reconnecting") return;
      p.status = "listening";
      p.statusAt = Date.now();
      broadcastParticipants(io, room);
    };

    socket.on(EVENTS.PRESENCE_SET, ({ status }) => {
      const room = inRoom();
      const p = me();
      if (!room || !p || !STATUSES.includes(status)) return;
      // `reconnecting` is the server's to assign — a client claiming it would
      // be claiming to be absent while plainly connected.
      if (status === "reconnecting" || p.status === status) return;
      p.status = status;
      p.statusAt = Date.now();
      broadcastParticipants(io, room);
    });

    socket.on(EVENTS.QUEUE_ADD, ({ track }) => {
      const room = inRoom();
      if (!room || !track?.videoId) return;
      const p = me();
      const item = enqueue(io, room, track, p?.nick || "guest");
      if (p) {
        p.songsAdded += 1;
        active(room);
        broadcastParticipants(io, room);
      }
      broadcastStats(io, room);
      pushChat(io, room, {
        system: true,
        kind: "queued",
        actor: item.addedBy,
        track: { title: item.title, artist: item.artist, thumbnail: item.thumbnail },
        text: `${item.addedBy} queued ${item.title}`,
      });
      if (!room.current) playNext(io, room);
    });

    socket.on(EVENTS.QUEUE_REMOVE, ({ id }) => {
      const room = host();
      if (!room) return;
      room.queue = room.queue.filter((t) => t.id !== id);
      broadcastQueue(io, room);
      persist();
    });

    /** Appreciation. Costs nothing, changes nothing, and people want it. */
    socket.on(EVENTS.QUEUE_LIKE, ({ id }) => {
      const room = inRoom();
      const p = me();
      if (!room || !p) return;
      const item = room.current?.id === id ? room.current : room.queue.find((t) => t.id === id);
      if (!item) return;
      item.likes = item.likes || [];
      const at = item.likes.indexOf(p.nick);
      if (at >= 0) item.likes.splice(at, 1);
      else item.likes.push(p.nick);
      active(room);
      broadcastQueue(io, room);
      broadcastPlayback(io, room);
      persist();
    });

    /**
     * A vote is a nudge up the queue, not just a number. One per person per
     * track, and it moves the track one place forward — so ten people wanting
     * the same song move it ten places, and a single enthusiast can't jump the
     * whole room. The count stays visible either way.
     */
    socket.on(EVENTS.QUEUE_VOTE, ({ id }) => {
      const room = inRoom();
      const p = me();
      if (!room || !p) return;
      const i = room.queue.findIndex((t) => t.id === id);
      if (i < 0) return;
      const item = room.queue[i];
      item.votes = item.votes || [];
      if (item.votes.includes(p.nick)) return;
      item.votes.push(p.nick);
      if (i > 0) {
        room.queue.splice(i, 1);
        room.queue.splice(i - 1, 0, item);
      }
      active(room);
      broadcastQueue(io, room);
      persist();
    });

    socket.on(EVENTS.QUEUE_REORDER, ({ id, toIndex }) => {
      const room = host();
      if (!room || typeof toIndex !== "number") return;
      const from = room.queue.findIndex((t) => t.id === id);
      if (from < 0) return;
      const to = Math.max(0, Math.min(room.queue.length - 1, Math.round(toIndex)));
      if (from === to) return;
      const [item] = room.queue.splice(from, 1);
      room.queue.splice(to, 0, item);
      broadcastQueue(io, room);
      persist();
    });

    socket.on(EVENTS.CONTROL_SKIP, () => {
      const room = host();
      if (room) playNext(io, room);
    });

    socket.on(EVENTS.VOTE_SKIP, () => {
      const room = inRoom();
      if (!room || !room.current) return;
      room.skipVotes.add(socket.id);
      active(room);
      const need = Math.ceil(room.participants.size * SKIP_THRESHOLD);
      if (room.skipVotes.size >= need) {
        pushChat(io, room, { system: true, kind: "skipped", text: `Vote passed — skipping` });
        playNext(io, room);
      } else {
        broadcastPlayback(io, room);
      }
    });

    socket.on(EVENTS.CONTROL_PLAYPAUSE, () => {
      const room = host();
      if (!room || !room.current || room.preparing) return;
      if (room.isPlaying) {
        room.pausedPosition = (monoNow() - room.startedAt) / 1000;
        room.isPlaying = false;
      } else {
        room.startedAt = monoNow() - room.pausedPosition * 1000;
        room.isPlaying = true;
      }
      broadcastPlayback(io, room);
    });

    socket.on(EVENTS.CONTROL_SEEK, ({ position }) => {
      const room = host();
      if (!room || !room.current || room.preparing) return;
      room.startedAt = monoNow() - position * 1000;
      if (!room.isPlaying) room.pausedPosition = position;
      broadcastPlayback(io, room);
    });

    socket.on(EVENTS.TRACK_ENDED, ({ videoId }) => {
      const room = host();
      if (room && room.current && room.current.videoId === videoId) {
        playNext(io, room, { fromEnd: true });
      }
    });

    socket.on(EVENTS.CONTROL_SHUFFLE, () => {
      const room = host();
      if (!room) return;
      room.shuffle = !room.shuffle;
      broadcastPlayback(io, room);
      persist();
    });

    socket.on(EVENTS.CONTROL_REPEAT, () => {
      const room = host();
      if (!room) return;
      const next = { off: "all", all: "one", one: "off" };
      room.repeat = next[room.repeat] ?? "all";
      broadcastPlayback(io, room);
      persist();
    });

    socket.on(EVENTS.CHAT_SEND, ({ text }) => {
      const room = inRoom();
      if (!room || !text?.trim()) return;
      const p = me();
      const nick = p?.nick || "guest";
      const clean = text.slice(0, 500);
      if (p) p.messages += 1;
      room.session.messages += 1;
      active(room);
      pushChat(io, room, { nick, text: clean });
      broadcastStats(io, room);
      refreshMood(io, room);
      // "/dj <request>" (or any message when the DJ is on) can enqueue music.
      if (djEnabled()) {
        const m = clean.match(/^\/dj\s+(.+)/i);
        if (m) handleDjRequest(io, room, m[1], nick);
      }
    });

    // Ephemeral floating emoji — broadcast to everyone, never stored.
    socket.on(EVENTS.REACTION, ({ emoji }) => {
      const room = inRoom();
      if (!room || typeof emoji !== "string" || emoji.length > 8) return;
      const p = me();
      // Who reacted travels with it so the activity feed can attribute it.
      // Deliberately not written to room.chat: reactions are the one thing in
      // here that can arrive several times a second, and the log is replayed
      // to everyone who joins.
      io.to(room.code).emit(EVENTS.REACTION_NEW, { emoji, nick: p?.nick, id: crypto.randomUUID() });

      room.session.reactions += 1;
      room.session.recentReactions.push({ ts: Date.now(), emoji });
      if (room.session.recentReactions.length > 400) room.session.recentReactions.shift();
      if (p) p.reactions[emoji] = (p.reactions[emoji] || 0) + 1;
      broadcastStats(io, room);
      refreshMood(io, room);
    });

    socket.on(EVENTS.SYNC_PING, ({ t0 }) => {
      socket.emit(EVENTS.SYNC_PONG, { t0, serverNow: monoNow() });
    });

    socket.on("disconnect", () => {
      const room = inRoom();
      if (!room) return;
      const p = room.participants.get(socket.id);
      room.skipVotes.delete(socket.id);
      if (room.hostId === socket.id) room.hostId = null;
      if (!p) return;

      // Hold the seat briefly. Phones suspend sockets when the screen locks and
      // a train goes through a tunnel; announcing a departure for either one is
      // noise, and the room can see they're reconnecting in the meantime.
      p.status = "reconnecting";
      p.statusAt = Date.now();
      // Beside the participant, never on it. See publicParticipant.
      dropTimers.set(
        socket.id,
        setTimeout(() => {
          dropTimers.delete(socket.id);
          const still = room.participants.get(socket.id);
          if (!still || still.status !== "reconnecting") return;
          room.participants.delete(socket.id);
          pushChat(io, room, {
            system: true,
            kind: "left",
            actor: still.nick,
            text: `${still.nick} left`,
          });
          broadcastParticipants(io, room);
          broadcastStats(io, room);
        }, RECONNECT_GRACE_MS)
      );

      // Rooms are durable — do NOT delete when empty; just update presence.
      broadcastParticipants(io, room);
    });
  });
}
