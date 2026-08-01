// In-memory room store (persisted to disk) + Socket.io wiring.
// The SERVER owns the playback clock; clients render their <audio> position
// from `startedAt`, so everyone stays in sync. Rooms are durable: they survive
// an empty room and a server restart (permanent links). Ownership is by a
// durable ownerToken the creator holds in localStorage.

import { customAlphabet } from "nanoid";
import { EVENTS, SKIP_THRESHOLD } from "./protocol.mjs";
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

/** @type {Map<string, any>} */
const rooms = (globalThis.__SW_ROOMS ??= new Map());

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
      queue: r.queue || [],
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
    });
  }
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
  };
  rooms.set(code, room);
  persist();
  return room;
}

export function getRoom(code) {
  return rooms.get(code);
}

function queueWithStatus(room) {
  return room.queue.map((t) => ({ ...t, status: cacheStatus(t.videoId) }));
}

function publicState(room, socketId) {
  return {
    code: room.code,
    name: room.name,
    queue: queueWithStatus(room),
    participants: [...room.participants.values()],
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
    participants: [...room.participants.values()],
  });
}

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

async function playNext(io, room, { fromEnd = false } = {}) {
  room.skipVotes.clear();

  // Repeat-one: a track that ends on its own just replays (no re-cache needed).
  // An explicit skip (fromEnd=false) bypasses this and moves on.
  if (fromEnd && room.repeat === "one" && room.current) {
    room.playToken++;
    room.startedAt = monoNow();
    room.isPlaying = true;
    room.preparing = false;
    broadcastPlayback(io, room);
    persist();
    return;
  }

  // Repeat-all: send the track we're leaving to the back of the queue.
  if (room.repeat === "all" && room.current) {
    room.queue.push(room.current);
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
      pushChat(io, room, { system: true, text: `Couldn't load "${next.title}" — skipping.` });
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
    generateIntro(next).then((intro) => {
      if (intro) pushChat(io, room, { nick: djName(), dj: true, text: intro });
    });
  } else {
    pushChat(io, room, { system: true, text: `Now playing: ${next.title} — ${next.artist}` });
  }
}

async function handleDjRequest(io, room, text, requester) {
  const query = await interpretRequest(text);
  if (!query) return;
  try {
    const results = await searchSongs(query, 1);
    const top = results[0];
    if (!top) return;
    const item = { ...top, id: crypto.randomUUID(), addedBy: djName() };
    room.queue.push(item);
    warm(io, room, item.videoId);
    broadcastQueue(io, room);
    persist();
    pushChat(io, room, {
      nick: djName(),
      dj: true,
      text: `On it, ${requester} — queuing "${top.title}" by ${top.artist}.`,
    });
    if (!room.current) playNext(io, room);
  } catch {
    /* ignore DJ failures */
  }
}

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
      const isHost = Boolean(ownerToken && ownerToken === room.ownerToken);
      if (isHost) room.hostId = socket.id;
      room.participants.set(socket.id, { id: socket.id, nick: nick || "guest", isHost });
      socket.join(room.code);
      socket.emit(EVENTS.ROOM_STATE, { ...publicState(room, socket.id), chat: room.chat });
      broadcastParticipants(io, room);
      pushChat(io, room, { system: true, text: `${nick || "guest"} joined` });
      // Resume a persisted queue on first presence.
      if (!room.current && room.queue.length) playNext(io, room);
    });

    const host = () => {
      const room = rooms.get(joinedCode);
      return room && room.participants.get(socket.id)?.isHost ? room : null;
    };

    socket.on(EVENTS.QUEUE_ADD, ({ track }) => {
      const room = rooms.get(joinedCode);
      if (!room || !track?.videoId) return;
      const p = room.participants.get(socket.id);
      const item = { ...track, id: crypto.randomUUID(), addedBy: p?.nick || "guest" };
      room.queue.push(item);
      warm(io, room, item.videoId);
      broadcastQueue(io, room);
      persist();
      pushChat(io, room, { system: true, text: `${item.addedBy} queued ${item.title}` });
      if (!room.current) playNext(io, room);
    });

    socket.on(EVENTS.QUEUE_REMOVE, ({ id }) => {
      const room = host();
      if (!room) return;
      room.queue = room.queue.filter((t) => t.id !== id);
      broadcastQueue(io, room);
      persist();
    });

    socket.on(EVENTS.CONTROL_SKIP, () => {
      const room = host();
      if (room) playNext(io, room);
    });

    socket.on(EVENTS.VOTE_SKIP, () => {
      const room = rooms.get(joinedCode);
      if (!room || !room.current) return;
      room.skipVotes.add(socket.id);
      const need = Math.ceil(room.participants.size * SKIP_THRESHOLD);
      if (room.skipVotes.size >= need) {
        pushChat(io, room, { system: true, text: `Vote passed — skipping` });
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
      const room = rooms.get(joinedCode);
      if (!room || !text?.trim()) return;
      const p = room.participants.get(socket.id);
      const nick = p?.nick || "guest";
      const clean = text.slice(0, 500);
      pushChat(io, room, { nick, text: clean });
      // "/dj <request>" (or any message when the DJ is on) can enqueue music.
      if (djEnabled()) {
        const m = clean.match(/^\/dj\s+(.+)/i);
        if (m) handleDjRequest(io, room, m[1], nick);
      }
    });

    // Ephemeral floating emoji — broadcast to everyone, never stored.
    socket.on(EVENTS.REACTION, ({ emoji }) => {
      const room = rooms.get(joinedCode);
      if (!room || typeof emoji !== "string" || emoji.length > 8) return;
      io.to(room.code).emit(EVENTS.REACTION_NEW, { emoji, id: crypto.randomUUID() });
    });

    socket.on(EVENTS.SYNC_PING, ({ t0 }) => {
      socket.emit(EVENTS.SYNC_PONG, { t0, serverNow: monoNow() });
    });

    socket.on("disconnect", () => {
      const room = rooms.get(joinedCode);
      if (!room) return;
      const p = room.participants.get(socket.id);
      room.participants.delete(socket.id);
      room.skipVotes.delete(socket.id);
      if (room.hostId === socket.id) room.hostId = null;
      if (p) pushChat(io, room, { system: true, text: `${p.nick} left` });
      // Rooms are durable — do NOT delete when empty; just update presence.
      broadcastParticipants(io, room);
    });
  });
}
