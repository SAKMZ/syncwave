import { NextRequest, NextResponse } from "next/server";
import { getRoom } from "@/lib/rooms.mjs";

export const dynamic = "force-dynamic";

// Per-room PWA manifest: installing from a room produces an app whose start_url
// is that room, so guests reopen straight into it — ideal for permanent rooms.
export function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") || "").toUpperCase();
  const room = getRoom(code);
  const name = room?.name || `Room ${code}`;
  return NextResponse.json(
    {
      name: `Syncwave · ${name}`,
      short_name: name,
      id: `/r/${code}`,
      start_url: `/r/${code}`,
      scope: "/",
      display: "standalone",
      background_color: "#08080e",
      theme_color: "#08080e",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } }
  );
}
