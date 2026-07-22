import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness probe for platform health checks (Render, Docker HEALTHCHECK, uptime
// monitors). Cheap on purpose — it must not touch yt-dlp or the network.
export async function GET() {
  return NextResponse.json({ ok: true, service: "syncwave", uptime: process.uptime() });
}
