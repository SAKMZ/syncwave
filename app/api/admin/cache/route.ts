import { NextResponse } from "next/server";
import { cacheStats, purgeCache, sweepCache } from "@/lib/resolver.mjs";
import { requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Admin-only: how much disk the audio cache is using, and a way to reclaim it.
// Gated because it reports what has been played on this instance.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ cache: await cacheStats() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { action } = await req.json().catch(() => ({ action: "" }));

  // Purge is safe: rooms and queues are untouched, a track just re-downloads
  // the next time someone plays it.
  if (action === "purge") {
    const result = await purgeCache();
    return NextResponse.json({ ...result, cache: await cacheStats() });
  }
  if (action === "sweep") {
    await sweepCache();
    return NextResponse.json({ cache: await cacheStats() });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
