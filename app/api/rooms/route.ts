import { NextRequest, NextResponse } from "next/server";
import { createRoom, getRoom } from "@/lib/rooms.mjs";

export const dynamic = "force-dynamic";

// Create a durable room. Returns the ownerToken the creator keeps to claim host.
export async function POST(req: NextRequest) {
  let name: string | undefined;
  try {
    const body = await req.json();
    name = body?.name;
  } catch {
    /* no body */
  }
  const room = createRoom(name);
  return NextResponse.json({ code: room.code, ownerToken: room.ownerToken, name: room.name });
}

// Check a room exists (for the join screen).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
  const room = code ? getRoom(code) : null;
  if (!room) return NextResponse.json({ exists: false }, { status: 404 });
  return NextResponse.json({ exists: true, name: room.name });
}
