// Tiny JSON-file persistence (no native deps — portable across Node 20/24 and
// Docker). Each namespace is one file under DATA_DIR, written debounced.
// Adequate for friends-scale; swap for SQLite later if it ever needs it.

import { promises as fs, readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

/** Load a namespace synchronously at startup. Returns `fallback` if missing. */
export function loadSync(name, fallback) {
  try {
    const raw = readFileSync(filePath(name), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const timers = new Map();

/** Debounced write — coalesces bursts of mutations into one disk write. */
export function saveDebounced(name, data, ms = 400) {
  clearTimeout(timers.get(name));
  timers.set(
    name,
    setTimeout(() => {
      fs.writeFile(filePath(name), JSON.stringify(data, null, 2)).catch((e) =>
        console.error(`store: failed to write ${name}:`, e.message)
      );
    }, ms)
  );
}

/** Force an immediate write (e.g. on settings change). */
export async function saveNow(name, data) {
  clearTimeout(timers.get(name));
  await fs.writeFile(filePath(name), JSON.stringify(data, null, 2));
}
