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

export async function searchSongs(query, limit = 15) {
  const yt = await getYT();
  const songs = await yt.searchSongs(query);
  return songs.slice(0, limit).map((s) => ({
    videoId: s.videoId,
    title: s.name,
    artist: Array.isArray(s.artists)
      ? s.artists.map((a) => a.name).join(", ")
      : s.artist?.name ?? "Unknown",
    duration: s.duration ?? 0,
    thumbnail: s.thumbnails?.[s.thumbnails.length - 1]?.url,
  }));
}
