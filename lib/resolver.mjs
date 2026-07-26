// Audio resolver: yt-dlp (via youtube-dl-exec) fetches a track's audio, caches
// it to disk, and serves it with HTTP range support. Adds: download-progress
// reporting, a cache index (last-played), cache-status queries for the queue
// UI, and a 72h-from-last-play eviction sweep.

import { createReadStream, promises as fs, statSync } from "fs";
import path from "path";
import youtubedl from "youtube-dl-exec";
import { loadSync, saveDebounced } from "./store.mjs";
import { cookiesFilePath } from "./ytcookies.mjs";
import { ffmpegPath } from "./ffmpeg.mjs";

const CACHE_DIR = path.resolve(process.env.CACHE_DIR || "./cache");
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

// youtube-dl-exec's own error only reports the exit code — the reason is on
// yt-dlp's stderr. Translate the failures worth acting on, and otherwise pass
// the tail through so a deploy problem is diagnosable from the logs.
function describeFailure(err, stderr) {
  const text = stderr.trim();
  if (/sign in to confirm you.?re not a bot|cookies for the authentication/i.test(text)) {
    return new Error(
      "YouTube bot-check: this host's IP is blocked. Cookies alone do not lift " +
        "it on datacenter IPs (Railway/Render/most VPS) — set YTDLP_PROXY to a " +
        "residential proxy, or run Syncwave from a home/residential connection. " +
        "See DEPLOY.md."
    );
  }
  if (/video unavailable|private video|removed by the uploader|age.?restricted/i.test(text)) {
    return new Error("Track is unavailable on YouTube.");
  }
  if (!text) return err;
  return new Error(`yt-dlp failed: ${text.split("\n").filter(Boolean).slice(-2).join(" ")}`);
}

function runDownload(out, videoId, onProgress, attempt = 1) {
  return new Promise((resolve, reject) => {
    // Resolved per download, so uploading cookies in the admin console takes
    // effect on the next track without a restart.
    const COOKIES = cookiesFilePath();
    // Datacenter IPs are blocked by YouTube regardless of cookies; routing
    // through a residential proxy is the only reliable fix on a cloud host.
    const PROXY = process.env.YTDLP_PROXY || "";
    // Only passed when we found a specific binary; otherwise yt-dlp searches
    // the PATH itself, which is the same behaviour as before.
    const FFMPEG = ffmpegPath();
    const sub = youtubedl.exec(`https://music.youtube.com/watch?v=${videoId}`, {
      output: out,
      extractAudio: true,
      audioFormat: "m4a",
      audioQuality: 0,
      noPlaylist: true,
      noWarnings: true,
      newline: true,
      ...(COOKIES ? { cookies: COOKIES } : {}),
      ...(PROXY ? { proxy: PROXY } : {}),
      ...(FFMPEG ? { ffmpegLocation: FFMPEG } : {}),
    });
    let errTail = "";
    const onData = (buf) => {
      const m = String(buf).match(/\[download\]\s+([\d.]+)%/);
      if (m) {
        const pct = Math.min(100, Math.round(parseFloat(m[1])));
        progress.set(videoId, pct);
        onProgress?.(pct);
      }
    };
    sub.stdout?.on("data", onData);
    sub.stderr?.on("data", (buf) => {
      errTail = (errTail + String(buf)).slice(-2000);
      onData(buf);
    });
    sub.then(() => resolve(out)).catch((err) => {
      // A bot-check won't pass on a retry — fail fast so the room skips sooner.
      const fatal = /sign in to confirm you.?re not a bot/i.test(errTail);
      if (attempt < 2 && !fatal) {
        setTimeout(
          () => runDownload(out, videoId, onProgress, attempt + 1).then(resolve, reject),
          1200
        );
      } else {
        const e = describeFailure(err, errTail);
        console.error(`[resolver] ${videoId}: ${e.message}`);
        reject(e);
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
