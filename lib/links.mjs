// Turning a pasted link into tracks the queue can play.
//
// Everyone already has their music somewhere, as a YouTube playlist or a
// Spotify one, and searching for it song by song is where people give up.
// Supported:
//
//   YouTube / YouTube Music  a song or video, a playlist, an album
//   Spotify                  a track, an album, a playlist (up to 100 tracks)
//
// YouTube gives us video IDs directly. Spotify doesn't play anywhere but
// Spotify, so each of its tracks is matched to the same song on YouTube Music
// by title, artist and length. No Spotify account or API key is involved: the
// public embed page carries the track list.

import { execFile } from "child_process";
import path from "path";
import youtubedl from "youtube-dl-exec";
import { getSong, searchSongs } from "./ytmusic.mjs";
import { denoPathDir } from "./jsruntime.mjs";

const MAX_TRACKS = 100;
const MATCH_CONCURRENCY = 3;
const VIDEO_ID = /^[\w-]{11}$/;

/**
 * What a URL points at, or null if it isn't something we can play.
 * @returns {{ provider: "youtube" | "spotify", type: string, id: string, url: string } | null}
 */
export function parseLink(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return VIDEO_ID.test(id) ? { provider: "youtube", type: "video", id, url: u.href } : null;
  }

  if (host === "youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v");
    const list = u.searchParams.get("list");
    const short = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/);
    // A song opened from inside a playlist carries both. The person almost
    // always meant the song they were looking at, not the whole list.
    if (v && VIDEO_ID.test(v)) return { provider: "youtube", type: "video", id: v, url: u.href };
    if (short) return { provider: "youtube", type: "video", id: short[1], url: u.href };
    // "RD…" lists are YouTube's endless auto-generated mixes, not playlists.
    if (list && !list.startsWith("RD")) {
      return { provider: "youtube", type: "playlist", id: list, url: `https://${host}/playlist?list=${list}` };
    }
    return null;
  }

  if (host === "open.spotify.com") {
    // Locale-prefixed links exist too: /intl-de/album/…
    const m = u.pathname.match(/^\/(?:intl-[\w-]+\/)?(track|album|playlist)\/([A-Za-z0-9]{22})/);
    return m ? { provider: "spotify", type: m[1], id: m[2], url: u.href } : null;
  }

  return null;
}

// ---------------------------------------------------------------- YouTube

const thumb = (id, size = "mqdefault") => `https://i.ytimg.com/vi/${id}/${size}.jpg`;

/**
 * Best guess at artist and title for a playlist entry. YouTube Music albums
 * come back clean; ordinary playlists are uploads named "Artist - Song
 * (Official Video)" on a channel that may or may not be the artist's.
 */
function splitEntry(e) {
  let title = String(e.title || "").trim();
  let artist = String(e.channel || e.uploader || "").trim();
  if (/ - Topic$/.test(artist)) {
    artist = artist.replace(/ - Topic$/, "");
  } else {
    const dash = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (dash) {
      artist = dash[1];
      title = dash[2];
    }
    artist = artist.replace(/VEVO$/i, "").trim();
  }
  title = title.replace(/\s*[([](official|lyric|audio|music video|visualizer|hd|4k)[^)\]]*[)\]]/gi, "").trim();
  return { title: title || "Unknown", artist: artist || "Unknown" };
}

function ytdlpJson(args) {
  const deno = denoPathDir();
  return new Promise((resolve, reject) => {
    execFile(
      youtubedl.constants.YOUTUBE_DL_PATH,
      [...args, "-J", "--no-warnings"],
      {
        timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
        env: deno ? { ...process.env, PATH: `${deno}${path.delimiter}${process.env.PATH ?? ""}` } : process.env,
      },
      (err, stdout, stderr) => {
        if (err) {
          const why = String(stderr || err.message).trim().split("\n").filter(Boolean).pop();
          return reject(new Error(why?.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, "") || "yt-dlp failed"));
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("Couldn't read that playlist."));
        }
      }
    );
  });
}

async function youtubeVideo(id) {
  try {
    const t = await getSong(id);
    if (t?.videoId) return t;
  } catch {
    /* not a song YouTube Music knows; fall back to the plain video */
  }
  const e = await ytdlpJson(["--no-playlist", `https://www.youtube.com/watch?v=${id}`]);
  const { title, artist } = splitEntry(e);
  return { videoId: id, title, artist, duration: e.duration ?? 0, thumbnail: thumb(id), art: thumb(id, "hqdefault") };
}

async function youtubePlaylist(link) {
  const data = await ytdlpJson(["--flat-playlist", "--playlist-end", String(MAX_TRACKS), link.url]);
  const tracks = (data.entries || [])
    .filter((e) => e?.id && VIDEO_ID.test(e.id) && e.title !== "[Private video]" && e.title !== "[Deleted video]")
    .map((e) => {
      const { title, artist } = splitEntry(e);
      return { videoId: e.id, title, artist, duration: e.duration ?? 0, thumbnail: thumb(e.id), art: thumb(e.id, "hqdefault") };
    });
  const name = String(data.title || "YouTube playlist").replace(/^Album - /, "");
  return {
    title: name,
    artist: data.channel || data.uploader || "YouTube",
    source: "YouTube",
    thumbnail: tracks[0]?.thumbnail,
    tracks,
    total: data.playlist_count ?? tracks.length,
  };
}

// ---------------------------------------------------------------- Spotify

async function spotifyEntity(type, id) {
  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Syncwave)", "accept-language": "en" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(res.status === 404 ? "Spotify says that link doesn't exist." : `Spotify returned ${res.status}.`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  const entity = m && JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error("Couldn't read that Spotify link. It may be private.");
  return entity;
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(feat[^)]*\)|\[feat[^\]]*\]|feat\..*$/g, "")
    .replace(/ - .*(remaster|version|edit|mix).*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The YouTube Music song that is this Spotify track. Ranked by how well the
 * title and artist agree, with a length within a few seconds as the
 * tie-breaker, which is what separates the studio cut from a live version.
 */
async function matchOnYouTube({ title, artist, seconds }) {
  const results = await searchSongs(`${title} ${artist}`, 6);
  const t = norm(title);
  const artists = String(artist || "").split(/,\s*|\s+&\s+/).map(norm).filter(Boolean);
  let best = null;
  let bestScore = -1;
  for (const r of results) {
    // The artist has to agree. A same-named song by someone else is the most
    // common wrong match, and a wrong song is worse than a gap in the list.
    const ra = norm(r.artist);
    if (!artists.some((a) => ra.includes(a) || (ra && a.includes(ra)))) continue;
    const rt = norm(r.title);
    let score = 0;
    if (rt === t) score += 3;
    else if (rt.includes(t) || t.includes(rt)) score += 2;
    else continue;
    if (seconds && r.duration) {
      const off = Math.abs(r.duration - seconds);
      if (off <= 4) score += 2;
      else if (off > 30) score -= 2; // live take, extended mix, different song
    }
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = await fn(items[i]);
        } catch {
          out[i] = null;
        }
      }
    })
  );
  return out;
}

async function spotifyList(link) {
  const e = await spotifyEntity(link.type, link.id);
  const wanted =
    link.type === "track"
      ? [{ title: e.name || e.title, artist: (e.artists || []).map((x) => x.name).join(", "), seconds: Math.round((e.duration || 0) / 1000) }]
      : (e.trackList || []).slice(0, MAX_TRACKS).map((t) => ({
          title: t.title,
          artist: t.subtitle,
          seconds: Math.round((t.duration || 0) / 1000),
        }));

  const matched = await mapLimit(wanted, MATCH_CONCURRENCY, matchOnYouTube);
  const tracks = matched.filter(Boolean);
  const missing = wanted.filter((_, i) => !matched[i]).map((w) => `${w.title} – ${w.artist}`);
  return {
    title: e.name || e.title || "Spotify",
    artist: link.type === "playlist" ? e.subtitle || "Spotify playlist" : e.subtitle || (e.artists || []).map((x) => x.name).join(", "),
    source: "Spotify",
    thumbnail: tracks[0]?.thumbnail,
    tracks,
    total: wanted.length,
    missing,
  };
}

// ---------------------------------------------------------------- entry point

/**
 * Resolve a link. Single songs come back as `{ kind: "track" }`; anything with
 * more than one song as `{ kind: "list" }` so the person can review it before
 * adding the lot.
 */
export async function resolveLink(input) {
  const link = parseLink(input);
  if (!link) throw new Error("That isn't a YouTube or Spotify link Syncwave can play.");

  if (link.provider === "youtube" && link.type === "video") {
    return { kind: "track", track: await youtubeVideo(link.id) };
  }
  if (link.provider === "youtube") {
    return { kind: "list", list: await youtubePlaylist(link) };
  }
  const list = await spotifyList(link);
  if (link.type === "track") {
    if (!list.tracks[0]) throw new Error("Couldn't find that song on YouTube Music.");
    return { kind: "track", track: list.tracks[0] };
  }
  return { kind: "list", list };
}
