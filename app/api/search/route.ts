import { NextRequest, NextResponse } from "next/server";
import { searchSongs } from "@/lib/ytmusic.mjs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  try {
    const results = await searchSongs(q);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: "search_failed", detail: String((err as Error)?.message || err) },
      { status: 502 }
    );
  }
}
