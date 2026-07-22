import { NextRequest, NextResponse } from "next/server";
import { cookiesStatus, saveCookies, clearCookies } from "@/lib/ytcookies.mjs";
import { requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ cookies: cookiesStatus() });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Sent as raw text — a cookies.txt is tab-delimited and does not survive a
  // trip through JSON cleanly enough to be worth the encoding.
  const text = await req.text();
  try {
    const status = await saveCookies(text);
    return NextResponse.json({ cookies: status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ cookies: await clearCookies() });
}
