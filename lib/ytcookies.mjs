// The YouTube cookies.txt that lets yt-dlp past the "Sign in to confirm you're
// not a bot" check on datacenter IPs. Uploaded through the admin console and
// stored beside the other durable data, so it survives restarts and redeploys.

import { promises as fs, existsSync, statSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const COOKIES_PATH = path.join(DATA_DIR, "cookies.txt");

/**
 * Path yt-dlp should use, or null. An explicit YTDLP_COOKIES_FILE wins so a
 * mounted file keeps working exactly as before; otherwise use the uploaded one.
 */
export function cookiesFilePath() {
  const fromEnv = process.env.YTDLP_COOKIES_FILE;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return existsSync(COOKIES_PATH) ? COOKIES_PATH : null;
}

export function cookiesStatus() {
  const fromEnv = process.env.YTDLP_COOKIES_FILE;
  if (fromEnv && existsSync(fromEnv)) {
    return { present: true, source: "env", path: fromEnv, uploadedAt: null };
  }
  if (existsSync(COOKIES_PATH)) {
    return {
      present: true,
      source: "upload",
      path: COOKIES_PATH,
      uploadedAt: statSync(COOKIES_PATH).mtimeMs,
    };
  }
  return { present: false, source: null, path: null, uploadedAt: null };
}

/**
 * Netscape cookie files are tab-separated with 7 fields per line. Checking the
 * shape here turns the most common mistake — pasting the wrong export, or a
 * JSON one — into a clear message instead of a silent playback failure later.
 */
export function validateCookies(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: "The file is empty." };
  }
  if (text.trimStart().startsWith("[") || text.trimStart().startsWith("{")) {
    return {
      ok: false,
      error:
        "That looks like a JSON cookie export. yt-dlp needs the Netscape " +
        "format — pick 'Netscape' or 'cookies.txt' in your extension.",
    };
  }
  const dataLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (!dataLines.length) {
    return { ok: false, error: "No cookie entries found in the file." };
  }
  const wellFormed = dataLines.filter((l) => l.split("\t").length === 7);
  if (!wellFormed.length) {
    return {
      ok: false,
      error:
        "No valid Netscape-format cookie lines found (expected 7 tab-separated " +
        "fields per line). Re-export with a 'Get cookies.txt' extension.",
    };
  }
  const youtube = wellFormed.filter((l) => /(^|\.)(youtube|google)\.com/i.test(l.split("\t")[0]));
  if (!youtube.length) {
    return {
      ok: false,
      error:
        "No youtube.com or google.com cookies in this file. Export it while " +
        "logged in to YouTube, not from another site.",
    };
  }
  const loggedIn = youtube.some((l) => /\b(SID|__Secure-\w*PSID|LOGIN_INFO)\b/.test(l));
  return { ok: true, count: youtube.length, loggedIn };
}

export async function saveCookies(text) {
  const check = validateCookies(text);
  if (!check.ok) throw new Error(check.error);
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Owner-only: this is a live YouTube session. `mode` on writeFile only applies
  // when the file is created, so chmod explicitly to also cover replacement of
  // a file that was put there by hand. No-op on Windows.
  await fs.writeFile(COOKIES_PATH, text, { mode: 0o600 });
  await fs.chmod(COOKIES_PATH, 0o600).catch(() => {});
  return { ...cookiesStatus(), count: check.count, loggedIn: check.loggedIn };
}

export async function clearCookies() {
  await fs.unlink(COOKIES_PATH).catch(() => {});
  return cookiesStatus();
}
