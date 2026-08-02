import { NextResponse } from "next/server";
import { testDj } from "@/lib/dj.mjs";
import { requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

/**
 * Ask the configured model to say one word, and report exactly what came back.
 *
 * Admin-only for two reasons: it spends a token on someone else's key, and the
 * provider's error text can name the model and the account. Everywhere else in
 * the app a failing DJ is swallowed so it can't take playback down with it —
 * this is the one place that shows the failure, which is the difference
 * between "the DJ is quiet" and "the model name has a capital letter in it".
 */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const result = await testDj();
  // 200 either way: the request succeeded, and whether the *model* answered is
  // in the body. A 500 here would be indistinguishable from the endpoint being
  // broken, which is the exact confusion this route exists to end.
  return NextResponse.json(result);
}
