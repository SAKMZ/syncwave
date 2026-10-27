// Synced lyrics from LRCLIB (https://lrclib.net), a free, open lyrics database
// that needs no key. Time-stamped ("synced") lyrics are what make this worth
// having: every listener is already on the same second, so every listener can
// be on the same line.
//
// Lookups are cached, including misses, so a room replaying its queue or a
// dozen listeners opening lyrics at once costs LRCLIB one request per song.

const UA = "Syncwave (https://github.com/SAKMZ/syncwave)";
const CACHE_MAX = 500;
const MISS_TTL_MS = 6 * 60 * 60 * 1000;

const cache = (globalThis.__SW_LYRICS ??= new Map());

/** Titles from YouTube Music carry decorations LRCLIB's don't. */
function cleanTitle(title) {
  return String(title || "")
    .replace(/\s*[([](feat|ft|with|prod)\.?[^)\]]*[)\]]/gi, "")
    .replace(/\s*[([][^)\]]*(remaster|version|edit|live|mono|stereo|deluxe|bonus)[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+.*(remaster|version|edit|live|mono|stereo).*$/i, "")
    .trim();
}

function firstArtist(artist) {
  return String(artist || "").split(/,|&| x | feat\.? /i)[0].trim();
}

/** "[01:23.45] line" → { t: 83.45, text: "line" }. A line can carry several stamps. */
export function parseLrc(lrc) {
  const lines = [];
  for (const raw of String(lrc || "").split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const s of stamps) {
      lines.push({ t: Number(s[1]) * 60 + Number(s[2].replace(":", ".")), text });
    }
  }
  return lines.sort((a, b) => a.t - b.t);
}

async function lrclib(pathname, params) {
  const u = new URL(pathname, "https://lrclib.net");
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, String(v));
  let res = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000) });
  // LRCLIB is a volunteer-run service and sheds load with a 503 now and then.
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000) });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB returned ${res.status}`);
  return res.json();
}

function shape(hit) {
  if (!hit) return null;
  const synced = hit.syncedLyrics ? parseLrc(hit.syncedLyrics) : [];
  return {
    synced: synced.length ? synced : null,
    plain: hit.plainLyrics || null,
    instrumental: Boolean(hit.instrumental),
  };
}

async function lookup({ title, artist, duration }) {
  const track_name = cleanTitle(title);
  const artist_name = firstArtist(artist);
  const seconds = Math.round(Number(duration) || 0);

  // Exact lookup first: LRCLIB matches on duration within a couple of seconds,
  // which is what picks the album cut over a live or radio edit.
  if (seconds) {
    const exact = await lrclib("/api/get", { track_name, artist_name, duration: seconds });
    if (exact && (exact.syncedLyrics || exact.plainLyrics || exact.instrumental)) return shape(exact);
  }

  // Then a search, preferring synced results whose length agrees.
  const found = await lrclib("/api/search", { track_name, artist_name });
  if (!Array.isArray(found) || !found.length) return null;
  const close = (h) => !seconds || !h.duration || Math.abs(h.duration - seconds) <= 5;
  const best =
    found.find((h) => h.syncedLyrics && close(h)) ||
    found.find((h) => h.plainLyrics && close(h)) ||
    null;
  return shape(best);
}

/**
 * Lyrics for a track, or `null` when LRCLIB doesn't have them.
 * @returns {Promise<{ synced: {t:number,text:string}[] | null, plain: string | null, instrumental: boolean } | null>}
 */
export async function getLyrics(track) {
  const key = `${track.videoId || ""}|${track.title}|${track.artist}`;
  const hit = cache.get(key);
  if (hit && (hit.value || Date.now() - hit.at < MISS_TTL_MS)) return hit.value;

  const value = await lookup(track);
  cache.set(key, { value, at: Date.now() });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
}
