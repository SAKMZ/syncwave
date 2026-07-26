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

function systemFfmpeg() {
  try {
    // Cheaper and more reliable than shelling out to which/where, which differ
    // per platform and shell.
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    return null;
  }
}

function bundledFfmpeg() {
  try {
    // Optional dependency: absent on installs that used --omit=optional (the
    // Docker image, which gets ffmpeg from apt instead).
    const mod = require("ffmpeg-static");
    const p = typeof mod === "string" ? mod : mod?.default;
    return p && existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

let cached;

/**
 * Absolute path (or bare "ffmpeg") to hand yt-dlp, or null to let it search the
 * PATH itself. Resolved once — this shells out, and the answer cannot change
 * while the process is running.
 */
export function ffmpegPath() {
  if (cached !== undefined) return cached;
  const override = process.env.FFMPEG_PATH;
  cached = (override && existsSync(override) ? override : null) ?? systemFfmpeg() ?? bundledFfmpeg();
  return cached;
}

/** True when no ffmpeg could be found — playback will fail until one exists. */
export function ffmpegMissing() {
  return ffmpegPath() === null;
}
