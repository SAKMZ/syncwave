import { NextRequest, NextResponse } from "next/server";
import { searchSongs } from "@/lib/ytmusic.mjs";
import { djEnabled, djName, suggestTracks } from "@/lib/dj.mjs";
import { MOODS } from "@/lib/protocol.mjs";

export const dynamic = "force-dynamic";

type Track = {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
  art?: string;
};

/**
 * What to play next.
 *
 * Two sources, and the response says which one answered so the UI can be
 * honest about it. With the AI DJ on, the active persona picks in its own
 * taste and with the room's mood in hand; the queries it returns are resolved
 * through ordinary search, so a title it imagined simply fails to resolve
 * instead of poisoning the queue. With the DJ off — or unreachable, or slow —
 * it falls back to searching the seed artist, which is what this endpoint did
 * before the DJ existed.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const title = p.get("title")?.trim();
  const artist = p.get("artist")?.trim();
  const moodId = p.get("mood")?.trim();
  const avoid = (p.get("avoid") || "").split("\n").filter(Boolean);
  const limit = Math.min(8, Math.max(1, Number(p.get("limit")) || 5));

  const mood = MOODS.find((m) => m.id === moodId) ?? null;
  const seed = title && artist ? { title, artist } : null;

  try {
    if (djEnabled()) {
      const queries: string[] = await suggestTracks({ seed, mood, avoid, count: limit });
      if (queries.length) {
        // One search per suggestion, in parallel, each taking the top hit.
        // Anything that doesn't resolve is dropped silently — a miss should
        // cost a row, not the whole panel.
        const settled = await Promise.allSettled(queries.map((q) => searchSongs(q, 1)));
        const seen = new Set<string>();
        const results: Track[] = [];
        for (const r of settled) {
          if (r.status !== "fulfilled") continue;
          const top = r.value[0];
          if (!top || seen.has(top.videoId)) continue;
          seen.add(top.videoId);
          results.push(top);
        }
        if (results.length) {
          return NextResponse.json({ results, source: "dj", dj: djName(), mood });
        }
      }
    }

    if (!artist) return NextResponse.json({ results: [], source: "none", mood });
    const results = await searchSongs(artist, limit + 6);
    return NextResponse.json({ results, source: "artist", seedArtist: artist, mood });
  } catch (err) {
    return NextResponse.json(
      { error: "recommend_failed", detail: String((err as Error)?.message || err) },
      { status: 502 }
    );
  }
}
