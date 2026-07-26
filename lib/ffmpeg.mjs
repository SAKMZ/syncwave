// Locating ffmpeg, which yt-dlp needs to extract audio as m4a.
//
// Desktop users generally do not have ffmpeg on their PATH, and telling them to
// install it by hand is the single biggest barrier to just running the app. So
// the `ffmpeg-static` package is an optional dependency that ships a platform
// binary, used only when the system does not already provide one.

import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function onPath() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function bundled() {
  try {
    // Optional dependency: absent on installs that used --omit=optional, and
    // deliberately removed from the Docker image, which gets ffmpeg from apt.
    const mod = require("ffmpeg-static");
    const p = typeof mod === "string" ? mod : mod?.default;
    return p && existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

let cached;
function resolve() {
  if (cached !== undefined) return cached;
  const override = process.env.FFMPEG_PATH;
  if (override && existsSync(override)) {
    cached = { path: override, found: true };
  } else if (onPath()) {
    // Let yt-dlp do its own PATH lookup. Passing the bare string "ffmpeg" to
    // --ffmpeg-location would be read as a *path* and fail to resolve.
    cached = { path: null, found: true };
  } else {
    const b = bundled();
    cached = { path: b, found: Boolean(b) };
  }
  return cached;
}

/**
 * Absolute path to hand yt-dlp via --ffmpeg-location, or null meaning "it's on
 * PATH, let yt-dlp find it". Null does NOT imply ffmpeg is missing.
 */
export function ffmpegPath() {
  return resolve().path;
}

/** True when no ffmpeg exists at all — playback will fail until one does. */
export function ffmpegMissing() {
  return !resolve().found;
}
