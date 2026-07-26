// YouTube Music search (metadata only) via ytmusic-api. Audio is resolved
// separately by the yt-dlp resolver. Shared by the Next API route and the
// server-side AI DJ. Server-side singleton.
import YTMusic from "ytmusic-api";

let ytPromise = null;

async function getYT() {
  if (!ytPromise) {
    const yt = new YTMusic();
    ytPromise = yt.initialize().then(() => yt);
  }
  return ytPromise;
}

/**
 * Ask for cover art at a specific size.
 *
 * The API hands back 120x120, which is fine for a list row and looks obviously
 * upscaled in the now-playing panel at 260px (520 on a retina screen). Both
 * hosts that serve this art take a size in the URL, so request what we will
 * actually draw instead of stretching a thumbnail.
 */
function sized(url, px) {
  if (!url) return url;
  // Google usercontent: ...=w120-h120-l90-rj
  if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+/, `=w${px}-h${px}`);
  // i.ytimg.com: /default.jpg, /mqdefault.jpg, /hqdefault.jpg …
  if (/i\.ytimg\.com/.test(url)) {
    const want = px >= 480 ? "maxresdefault" : px >= 320 ? "hqdefault" : "mqdefault";
    return url.replace(/\/(default|mqdefault|hqdefault|sddefault|maxresdefault)\.jpg/, `/${want}.jpg`);
  }
  return url;
}

export async function searchSongs(query, limit = 15) {
  const yt = await getYT();
  const songs = await yt.searchSongs(query);
  return songs.slice(0, limit).map((s) => {
    const raw = s.thumbnails?.[s.thumbnails.length - 1]?.url;
    return {
      videoId: s.videoId,
      title: s.name,
      artist: Array.isArray(s.artists)
        ? s.artists.map((a) => a.name).join(", ")
        : s.artist?.name ?? "Unknown",
      duration: s.duration ?? 0,
      // Left at the size the API gives (120px), which is already oversampled for
      // the 40-44px list rows. Requesting bigger art for a whole page of results
      // gets a burst of them throttled and they fail to load entirely.
      thumbnail: raw,
      // Only the now-playing hero draws art large enough to need this, and it
      // fetches exactly one.
      art: sized(raw, 544),
    };
  });
}
