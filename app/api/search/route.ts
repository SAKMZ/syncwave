import { NextRequest, NextResponse } from "next/server";
import { searchSongs, searchAlbums, searchArtists } from "@/lib/ytmusic.mjs";

export const dynamic = "force-dynamic";

/**
 * One endpoint, three result types. `type` defaults to songs so every existing
 * caller keeps working unchanged, and the response always carries `results`
 * for the same reason.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const type = req.nextUrl.searchParams.get("type") ?? "songs";
  if (!q) return NextResponse.json({ results: [], type });

  try {
    const results =
      type === "albums"
        ? await searchAlbums(q)
        : type === "artists"
          ? await searchArtists(q)
          : await searchSongs(q);
    return NextResponse.json({ results, type });
  } catch (err) {
    return NextResponse.json(
      { error: "search_failed", detail: String((err as Error)?.message || err) },
      { status: 502 }
    );
  }
}
