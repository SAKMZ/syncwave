import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySession,
  isSetupComplete,
} from "@/lib/auth.mjs";

/** Typed here rather than in auth.mjs so `sameSite` narrows for Next's cookie API. */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;

/** True when the caller holds a valid admin session cookie. */
export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Guard for admin API routes. Returns a response to send back, or null when the
 * caller may proceed. Distinguishes "not set up yet" from "not logged in" so the
 * client can route to /setup rather than showing a login it cannot pass.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (!isSetupComplete()) {
    return NextResponse.json({ error: "setup_required" }, { status: 409 });
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
