// Shared realtime protocol between the Socket.io server and browser clients.
// Keep this framework-free so both server.mjs and the React client can import it.

export const EVENTS = {
  // client -> server
  JOIN: "join",
  QUEUE_ADD: "queue:add",
  QUEUE_REMOVE: "queue:remove",
  CONTROL_SKIP: "control:skip",
  CONTROL_PLAYPAUSE: "control:playpause",
  CONTROL_SEEK: "control:seek",
  CONTROL_SHUFFLE: "control:shuffle",
  CONTROL_REPEAT: "control:repeat",
  VOTE_SKIP: "vote:skip",
  CHAT_SEND: "chat:send",
  REACTION: "reaction",
  SYNC_PING: "sync:ping",
  TRACK_ENDED: "track:ended",

  // server -> client
  ROOM_STATE: "room:state",
  QUEUE_UPDATE: "queue:update",
  PLAYBACK_UPDATE: "playback:update",
  PARTICIPANTS_UPDATE: "participants:update",
  CHAT_NEW: "chat:new",
  REACTION_NEW: "reaction:new",
  SYNC_PONG: "sync:pong",
  DOWNLOAD_PROGRESS: "download:progress",
  ERROR: "sw:error",
};

// Emoji a listener can fling into the room.
export const REACTIONS = ["❤️", "🔥", "😂", "🎉", "👍", "🎧"];

// Fraction of votes needed to skip the current track.
export const SKIP_THRESHOLD = 0.5;
