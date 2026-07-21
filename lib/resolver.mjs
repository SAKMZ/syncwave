// Audio resolver: yt-dlp (via youtube-dl-exec) fetches a track's audio, caches
// it to disk, and serves it with HTTP range support. Adds: download-progress
// reporting, a cache index (last-played), cache-status queries for the queue
// UI, and a 72h-from-last-play eviction sweep.

import { createReadStream, promises as fs, statSync } from "fs";
import path from "path";
import youtubedl from "youtube-dl-exec";
import { loadSync, saveDebounced } from "./store.mjs";

const CACHE_DIR = path.resolve(process.env.CACHE_DIR || "./cache");
const COOKIES = process.env.YTDLP_COOKIES_FILE || null;
const RETAIN_MS = 72 * 60 * 60 * 1000; // keep 72h from last play

// videoId -> { lastPlayed, title, artist }
const cacheIndex = (globalThis.__SW_CACHE_INDEX ??= loadSync("cache-index", {}));
// videoId -> percent (0-100) while a download is in flight
const progress = new Map();
const inFlight = new Map();

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}
function cachePath(videoId) {
  return path.join(CACHE_DIR, `${videoId}.m4a`);
}
function fileExistsSync(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

/** 'cached' | 'downloading' | 'pending' (+ percent when downloading). */
export function cacheStatus(videoId) {
  if (fileExistsSync(cachePath(videoId))) return { state: "cached", percent: 100 };
  if (inFlight.has(videoId))
    return { state: "downloading", percent: progress.get(videoId) ?? 0 };
  return { state: "pending", percent: 0 };
}

/** Record that a track was played now (drives 72h retention). */
export function touchCache(videoId, meta = {}) {
  cacheIndex[videoId] = { ...cacheIndex[videoId], ...meta, lastPlayed: Date.now() };
  saveDebounced("cache-index", cacheIndex);
}

function runDownload(out, videoId, onProgress, attempt = 1) {
  return new Promise((resolve, reject) => {
    const sub = youtubedl.exec(`https://music.youtube.com/watch?v=${videoId}`, {
      output: out,
      extractAudio: true,
      audioFormat: "m4a",
      audioQuality: 0,
      noPlaylist: true,
      noWarnings: true,
      newline: true,
      ...(COOKIES ? { cookies: COOKIES } : {}),
    });
    const onData = (buf) => {
      const m = String(buf).match(/\[download\]\s+([\d.]+)%/);
      if (m) {
        const pct = Math.min(100, Math.round(parseFloat(m[1])));
        progress.set(videoId, pct);
        onProgress?.(pct);
      }
    };
    sub.stdout?.on("data", onData);
    sub.stderr?.on("data", onData);
    sub.then(() => resolve(out)).catch((err) => {
      if (attempt < 2) {
        setTimeout(
          () => runDownload(out, videoId, onProgress, attempt + 1).then(resolve, reject),
          1200
        );
      } else {
        reject(err);
      }
    });
  });
}

/** Download bestaudio as m4a (needs ffmpeg). Returns the file path. */
export async function ensureAudio(videoId, onProgress) {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error("bad videoId");
  await ensureCacheDir();
  const out = cachePath(videoId);
  if (fileExistsSync(out)) return out;
  if (inFlight.has(videoId)) return inFlight.get(videoId);

  progress.set(videoId, 0);
  const job = runDownload(out, videoId, onProgress).finally(() => {
    inFlight.delete(videoId);
    progress.delete(videoId);
  });
  inFlight.set(videoId, job);
  return job;
}

/** Warm a track without blocking; reports progress via callback. */
export function prefetchAudio(videoId, onProgress) {
  ensureAudio(videoId, onProgress).catch(() => {});
}

/** Delete cached files not played within the retention window. */
export async function sweepCache() {
  try {
    const files = await fs.readdir(CACHE_DIR).catch(() => []);
    const now = Date.now();
    for (const f of files) {
      if (!f.endsWith(".m4a")) continue;
      const id = f.replace(/\.m4a$/, "");
      const rec = cacheIndex[id];
      let last = rec?.lastPlayed;
      if (!last) {
        // Unknown file: fall back to filesystem mtime.
        last = statSync(path.join(CACHE_DIR, f)).mtimeMs;
      }
      if (now - last > RETAIN_MS) {
        await fs.unlink(path.join(CACHE_DIR, f)).catch(() => {});
        delete cacheIndex[id];
      }
    }
    saveDebounced("cache-index", cacheIndex);
  } catch (e) {
    console.error("sweepCache failed:", e.message);
  }
}

/** Raw HTTP handler for GET /audio/<videoId>, with Range support. */
export async function handleAudioRequest(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const videoId = url.pathname.replace("/audio/", "").replace(/\.m4a$/, "");
    const file = await ensureAudio(videoId);
    const { size } = statSync(file);
    const range = req.headers.range;
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10) || 0;
      const end = endStr ? parseInt(endStr, 10) : size - 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": "audio/mp4",
      });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": size,
        "Content-Type": "audio/mp4",
        "Accept-Ranges": "bytes",
      });
      createReadStream(file).pipe(res);
    }
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "resolve_failed", detail: String(err?.message || err) }));
  }
}
