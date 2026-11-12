import { NextRequest, NextResponse } from "next/server";
import { createRoom, getRoom } from "@/lib/rooms.mjs";
import { clientIp, rateLimit } from "@/lib/ratelimit.mjs";

export const dynamic = "force-dynamic";

// Rooms are held in memory and persisted, so creating them is the one
// unauthenticated write anyone can repeat forever. The ceiling is per address
// and per hour, set well above what a person does — you make a room, you send
// the link, you listen — and low enough that a loop gets bored. Set
// ROOM_CREATE_LIMIT=0 to turn it off on a private instance.
const CREATE_LIMIT = Math.max(0, Number(process.env.ROOM_CREATE_LIMIT ?? 20));
const CREATE_WINDOW_MS = 60 * 60 * 1000;

// Create a durable room. Returns the ownerToken the creator keeps to claim host.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (ip) {
    const { ok, retryAfter } = rateLimit(`rooms:${ip}`, CREATE_LIMIT, CREATE_WINDOW_MS);
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "That's a lot of rooms from one place. Try again shortly, or self-host your own — it takes about a minute.",
        },
        { status: 429, headers: { "retry-after": String(retryAfter) } }
      );
    }
  }

  let name: string | undefined;
  let inviteOnly: boolean | undefined;
  let wanted: string | undefined;
  try {
    const body = await req.json();
    name = body?.name;
    inviteOnly = Boolean(body?.inviteOnly);
    // An optional fixed code: "make this room live at /r/<code> forever".
    // Random 6-char codes stay the default; a fixed one has to be asked for.
    if (typeof body?.code === "string" && body.code.trim()) {
      const candidate = body.code.trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(candidate)) {
        return NextResponse.json(
          { error: "code must be 3-32 chars: A-Z, 0-9, dash" },
          { status: 400 }
        );
      }
      if (getRoom(candidate)) {
        return NextResponse.json({ error: "code_taken" }, { status: 409 });
      }
      wanted = candidate;
    }
  } catch {
    /* no body */
  }
  const room = createRoom(name, inviteOnly, wanted);
  return NextResponse.json({ code: room.code, ownerToken: room.ownerToken, name: room.name });
}

// Check a room exists (for the join screen).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
  const room = code ? getRoom(code) : null;
  if (!room) return NextResponse.json({ exists: false }, { status: 404 });
  return NextResponse.json({ exists: true, name: room.name });
}
