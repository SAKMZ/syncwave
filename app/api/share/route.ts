import { NextResponse } from "next/server";
import { getPublicUrl } from "@/lib/publicurl.mjs";

export const dynamic = "force-dynamic";

// What the room UI should offer as a share link. Unauthenticated on purpose:
// it is the address the page is already reachable on, not a secret.
export async function GET() {
  return NextResponse.json({ publicUrl: getPublicUrl() });
}
