import { NextRequest, NextResponse } from "next/server";
import {
  isSetupComplete,
  setAdminPassword,
  verifyPassword,
  createSession,
  SESSION_COOKIE,
} from "@/lib/auth.mjs";
import { isAuthed, sessionCookieOptions } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Lets the client decide between /setup, /admin/login and /admin. */
export async function GET() {
  return NextResponse.json({
    setupComplete: isSetupComplete(),
    authed: await isAuthed(),
  });
}

/**
 * action=setup  — claim the instance by setting the first admin password.
 * action=login  — exchange a password for a session.
 * action=logout — drop the session.
 */
export async function POST(req: NextRequest) {
  let body: { action?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { action, password } = body;

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }

  if (action === "setup") {
    // Only ever available on an unclaimed instance — otherwise this would be a
    // password reset that needs no password.
    if (isSetupComplete()) {
      return NextResponse.json({ error: "already_setup" }, { status: 409 });
    }
    try {
      await setAdminPassword(password ?? "");
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, createSession(), {
      ...sessionCookieOptions,
      secure: req.nextUrl.protocol === "https:",
    });
    return res;
  }

  if (action === "login") {
    if (!verifyPassword(password ?? "")) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, createSession(), {
      ...sessionCookieOptions,
      secure: req.nextUrl.protocol === "https:",
    });
    return res;
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
