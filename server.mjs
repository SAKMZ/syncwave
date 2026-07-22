// Custom Syncwave server: Next.js (UI + API routes) + Socket.io (realtime sync
// & chat) + a raw /audio route (range-served, yt-dlp-backed) on one HTTP server,
// so the whole app is a single process / single container.

import { createServer } from "http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { registerRoomHandlers } from "./lib/rooms.mjs";
import { handleAudioRequest, sweepCache } from "./lib/resolver.mjs";

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

// Platforms inject their own public hostname, so a one-click deploy gets a
// correct origin without the user setting anything. Railway gives a bare host,
// Render gives a full URL.
const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "";
const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || railwayUrl || "";

const io = new IOServer(server, {
  cors: { origin: publicUrl || true },
});
registerRoomHandlers(io);

// Evict cache files not played within 72h — sweep at boot and hourly.
sweepCache();
setInterval(sweepCache, 60 * 60 * 1000);

server.listen(port, () => {
  console.log(`> Syncwave ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
});
