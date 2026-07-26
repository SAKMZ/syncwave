// Custom Syncwave server: Next.js (UI + API routes) + Socket.io (realtime sync
// & chat) + a raw /audio route (range-served, yt-dlp-backed) on one HTTP server,
// so the whole app is a single process / single container.

import { createServer } from "http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { registerRoomHandlers } from "./lib/rooms.mjs";
import { handleAudioRequest, sweepCache } from "./lib/resolver.mjs";
import { ffmpegMissing } from "./lib/ffmpeg.mjs";
import { jsRuntimeMissing } from "./lib/jsruntime.mjs";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  if (req.url && req.url.startsWith("/audio/")) {
    handleAudioRequest(req, res);
    return;
  }
  handle(req, res);
});

// Unset means "reflect the requesting origin", which is what you want on a LAN
// where the host is reached by IP, hostname, and tailnet name interchangeably.
const publicUrl = process.env.PUBLIC_URL || "";

const io = new IOServer(server, {
  cors: { origin: publicUrl || true },
});
registerRoomHandlers(io);

// Evict cache files not played within 72h — sweep at boot and hourly.
sweepCache();
setInterval(sweepCache, 60 * 60 * 1000);

server.listen(port, () => {
  console.log(`> Syncwave ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
  if (ffmpegMissing()) {
    console.warn(
      "! ffmpeg was not found. Tracks will fail to convert.\n" +
        "  Install it and restart, or run `npm install` to fetch the bundled copy."
    );
  }
  if (jsRuntimeMissing()) {
    console.warn(
      "! No JavaScript runtime (deno) found. YouTube will bot-check this server\n" +
        "  and tracks will fail. Run `npm install` to fetch the bundled copy."
    );
  }
});
