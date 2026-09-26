// Keeping yt-dlp current.
//
// YouTube changes how it serves audio every few weeks, and an outdated yt-dlp
// fails with "HTTP Error 403: Forbidden" on every track. That looks exactly
// like an IP block, so the obvious diagnosis is wrong: measured on a home
// connection, a two-month-old yt-dlp refused every track, and `yt-dlp -U` fixed
// it immediately. A long-running server would otherwise drift into that state
// and stay there until someone rebuilt it.
//
// So the binary updates itself: once at boot if it's due, weekly after that,
// and early when a download fails with a 403, since that is the one symptom an
// update most often cures. The last check is persisted so restarts don't
// re-download, and a box that sleeps through its schedule catches up on waking.

import { execFile } from "child_process";
import youtubedl from "youtube-dl-exec";
import { loadSync, saveNow } from "./store.mjs";

const BINARY = youtubedl.constants.YOUTUBE_DL_PATH;
const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = Math.max(1, Number(process.env.YTDLP_UPDATE_DAYS) || 7) * DAY_MS;
// A 403 can also be a genuine IP block, which no update fixes. Don't hammer
// GitHub every time one happens.
const FORBIDDEN_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const POLL_MS = 60 * 60 * 1000;

const state = (globalThis.__SW_YTDLP ??= {
  saved: loadSync("ytdlp", { checkedAt: 0, version: "" }),
  running: null,
  unsupported: false,
  timer: null,
});

export function ytdlpAutoUpdateEnabled() {
  return !/^(0|false|no|off)$/i.test(process.env.YTDLP_AUTO_UPDATE?.trim() || "");
}

function run(args, timeout) {
  return new Promise((resolve) => {
    execFile(BINARY, args, { timeout, windowsHide: true }, (err, stdout, stderr) =>
      resolve({ err, out: `${stdout || ""}${stderr || ""}` })
    );
  });
}

/**
 * Run `yt-dlp -U`. Concurrent callers share one attempt. Resolves to a short
 * description of what happened; never throws, because a failed update must
 * not take anything else down with it.
 */
export function updateYtdlp(reason = "scheduled") {
  if (state.running) return state.running;
  if (state.unsupported) return Promise.resolve("unsupported");

  state.running = (async () => {
    const { err, out } = await run(["-U"], 3 * 60 * 1000);
    const updated = out.match(/Updated yt-dlp to\s+(?:\S+@)?([\d.]+)/i);
    // e.g. "yt-dlp is up to date (stable@2026.08.19 from yt-dlp/yt-dlp)"
    const current = out.match(/yt-dlp is up to date \((?:\S+@)?([\d.]+)/i);
    let result;

    if (updated) {
      result = `updated to ${updated[1]}`;
      state.saved.version = updated[1];
    } else if (current) {
      result = `up to date (${current[1]})`;
      state.saved.version = current[1];
    } else if (/installed yt-dlp with pip|package manager|cannot be updated|not supported/i.test(out)) {
      // Installed some way -U can't touch. Say so once and stop trying.
      state.unsupported = true;
      console.warn(`[yt-dlp] can't self-update this install; update it with the tool that installed it.`);
      return "unsupported";
    } else {
      // Offline, GitHub rate limit, a locked file on Windows while a download
      // runs. All transient: leave checkedAt alone so the next poll retries.
      const why = (err?.message || out).trim().split("\n").filter(Boolean).pop() || "unknown error";
      console.warn(`[yt-dlp] update check failed (${reason}): ${why}`);
      return "failed";
    }

    state.saved.checkedAt = Date.now();
    await saveNow("ytdlp", state.saved).catch(() => {});
    console.log(`[yt-dlp] ${result} (${reason})`);
    return result;
  })().finally(() => {
    state.running = null;
  });

  return state.running;
}

/** Called by the resolver when a download fails with a 403. */
export function noteYtdlpForbidden() {
  if (!ytdlpAutoUpdateEnabled()) return;
  if (Date.now() - state.saved.checkedAt < FORBIDDEN_COOLDOWN_MS) return;
  updateYtdlp("after a 403").catch(() => {});
}

/** Check shortly after boot, then hourly whether the weekly update is due. */
export function startYtdlpUpdates() {
  if (!ytdlpAutoUpdateEnabled() || state.timer) return;
  const check = () => {
    if (Date.now() - state.saved.checkedAt >= INTERVAL_MS) updateYtdlp("weekly").catch(() => {});
  };
  // Let the server finish starting before spending a few seconds on this.
  setTimeout(check, 30 * 1000).unref?.();
  state.timer = setInterval(check, POLL_MS);
  state.timer.unref?.();
}
