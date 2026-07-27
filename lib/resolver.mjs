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
import { denoPathDir } from "./jsruntime.mjs";
import { proxiesConfigured, orderedProxies, markProxy, redactProxy } from "./proxies.mjs";

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
  // A 429 is a temporary rate limit and clears on its own. It surfaces as the
  // same bot-check message as a hard IP block, so check for it first —
  // otherwise a user who simply queued a lot of tracks is told to go buy a proxy.
  if (/HTTP Error 429|Too Many Requests/i.test(text)) {
    return new Error(
      "YouTube is rate-limiting this server (HTTP 429). This is temporary — " +
        "wait a few minutes and try again. Adding many tracks in quick " +
        "succession is the usual cause."
    );
  }
  if (/sign in to confirm you.?re not a bot|cookies for the authentication/i.test(text)) {
    return new Error(
      "YouTube bot-check. On a home connection this usually means a temporary " +
        "rate limit — wait a few minutes. On a VPS or cloud host the IP range " +
        "itself is blocked, and " +
        (proxiesConfigured()
          ? "every proxy in the pool was refused too. Check the pool still has " +
            "working addresses, or upload a cookies.txt in /admin."
          : "no proxy pool is configured: set WEBSHARE_API_KEY (or " +
            "YTDLP_PROXY_LIST), or upload a cookies.txt in /admin.") +
        " See DEPLOY.md."
    );
  }
  if (/video unavailable|private video|removed by the uploader|age.?restricted/i.test(text)) {
    return new Error("Track is unavailable on YouTube.");
  }
  if (!text) return err;
  return new Error(`yt-dlp failed: ${text.split("\n").filter(Boolean).slice(-2).join(" ")}`);
}

/**
 * True when a failure looks like IP reputation rather than the track itself.
 * These are the only ones worth retrying down a different route — a deleted
 * video fails identically through every proxy in the pool.
 */
function isRouteBlocked(text) {
  return (
    /sign in to confirm you.?re not a bot|cookies for the authentication/i.test(text) ||
    /HTTP Error 429|Too Many Requests/i.test(text) ||
    /HTTP Error 403|Forbidden/i.test(text)
  );
}

function runDownload(out, videoId, onProgress, proxy = "", attempt = 1) {
  return new Promise((resolve, reject) => {
    // Resolved per download, so uploading cookies in the admin console takes
    // effect on the next track without a restart.
    const COOKIES = cookiesFilePath();
    const PROXY = proxy;
    // Only passed when we found a specific binary; otherwise yt-dlp searches
    // the PATH itself, which is the same behaviour as before.
    const FFMPEG = ffmpegPath();
    // yt-dlp discovers deno on PATH, so surface a bundled copy that way rather
    // than passing --js-runtimes and pinning ourselves to one runtime name.
    const DENO_DIR = denoPathDir();
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
    }, DENO_DIR ? { env: { ...process.env, PATH: `${DENO_DIR}${path.delimiter}${process.env.PATH ?? ""}` } } : undefined);
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
      // A bot-check won't pass on an immediate retry down the same route — fail
      // fast so the caller can try the next one. (A 429 won't clear in 1.2s
      // either.) Anything else is worth one quick retry for a network blip.
      if (attempt < 2 && !isRouteBlocked(errTail)) {
        setTimeout(
          () => runDownload(out, videoId, onProgress, proxy, attempt + 1).then(resolve, reject),
          1200
        );
      } else {
        err.errTail = errTail;
        reject(err);
      }
    });
  });
}

/**
 * Try the direct connection, then each proxy in turn until one delivers.
 *
 * Direct goes first deliberately. At home it simply works, and on a metered
 * proxy plan every byte not spent is another track someone gets to play. The
 * pool is only reached for on an IP-reputation failure, and the outcome of each
 * attempt is recorded so the next track starts with a route that just worked.
 */
async function downloadWithFallback(out, videoId, onProgress) {
  const routes = [""];
  if (proxiesConfigured()) routes.push(...(await orderedProxies()));

  let last = null;
  for (let i = 0; i < routes.length; i++) {
    const proxy = routes[i];
    try {
      const done = await runDownload(out, videoId, onProgress, proxy);
      if (proxy) markProxy(proxy, true);
      if (i > 0) console.log(`[resolver] ${videoId}: served via ${redactProxy(proxy)}`);
      return done;
    } catch (err) {
      const tail = err.errTail || "";
      if (proxy) markProxy(proxy, false);
      last = { err, tail };
      const more = i < routes.length - 1;
      if (!isRouteBlocked(tail) || !more) break;
      console.warn(
        `[resolver] ${videoId}: ${redactProxy(proxy)} refused — trying ${redactProxy(routes[i + 1])}`
      );
      // Progress restarts from zero on the next route; don't leave the old
      // percentage on screen implying the transfer is still advancing.
      progress.set(videoId, 0);
      onProgress?.(0);
    }
  }
  const e = describeFailure(last.err, last.tail);
  console.error(`[resolver] ${videoId}: ${e.message}`);
  throw e;
}

/** Download bestaudio as m4a (needs ffmpeg). Returns the file path. */
export async function ensureAudio(videoId, onProgress) {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error("bad videoId");
  await ensureCacheDir();
  const out = cachePath(videoId);
  if (fileExistsSync(out)) return out;
  if (inFlight.has(videoId)) return inFlight.get(videoId);

  progress.set(videoId, 0);
  const job = downloadWithFallback(out, videoId, onProgress).finally(() => {
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
