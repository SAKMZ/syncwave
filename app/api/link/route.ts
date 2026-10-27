import { NextRequest, NextResponse } from "next/server";
import { resolveLink } from "@/lib/links.mjs";
import { clientIp, rateLimit } from "@/lib/ratelimit.mjs";

export const dynamic = "force-dynamic";

// A Spotify playlist is up to a hundred searches against YouTube Music, so a
// link costs far more than a search does. Generous for a person pasting a few
// playlists; low enough that a script can't use the instance as a free
// Spotify-to-YouTube converter.
const LIMIT = Number(process.env.LINK_IMPORT_LIMIT ?? 30);

/** Resolve a pasted YouTube or Spotify link into playable tracks. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "missing_url" }, { status: 400 });

  const ip = clientIp(req) ?? "local";
  const gate = rateLimit(`link:${ip}`, LIMIT, 60 * 60 * 1000);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many links in the last hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } }
    );
  }

  try {
    return NextResponse.json(await resolveLink(url));
  } catch (err) {
    return NextResponse.json(
      { error: "link_failed", message: String((err as Error)?.message || err) },
      { status: 422 }
    );
  }
}
