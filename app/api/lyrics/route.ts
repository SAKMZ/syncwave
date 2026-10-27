import { NextRequest, NextResponse } from "next/server";
import { getLyrics } from "@/lib/lyrics.mjs";

export const dynamic = "force-dynamic";

/** Lyrics for the track playing, synced line by line where LRCLIB has them. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const title = p.get("title")?.trim();
  const artist = p.get("artist")?.trim();
  if (!title || !artist) return NextResponse.json({ error: "missing_track" }, { status: 400 });

  try {
    const lyrics = await getLyrics({
      videoId: p.get("id") ?? "",
      title: title.slice(0, 200),
      artist: artist.slice(0, 200),
      duration: Number(p.get("duration")) || 0,
    });
    return NextResponse.json(
      { lyrics },
      // Lyrics for a song don't change; let the browser keep them for a while.
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "lyrics_failed", detail: String((err as Error)?.message || err) },
      { status: 502 }
    );
  }
}
