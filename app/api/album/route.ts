import { NextRequest, NextResponse } from "next/server";
import { albumTracks } from "@/lib/ytmusic.mjs";

export const dynamic = "force-dynamic";

/** The track list behind an album result, so a whole record can be queued. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  try {
    return NextResponse.json({ album: await albumTracks(id) });
  } catch (err) {
    return NextResponse.json(
      { error: "album_failed", detail: String((err as Error)?.message || err) },
      { status: 502 }
    );
  }
}
