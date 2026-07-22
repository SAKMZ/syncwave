import { NextRequest, NextResponse } from "next/server";
import { getPublicSettings, updateSettings } from "@/lib/settings.mjs";
import { PERSONAS } from "@/lib/personas.mjs";
import { requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Admin-only: these settings include which LLM provider is wired up and whether
// a key is present, which is not public information about someone's instance.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ settings: getPublicSettings(), personas: PERSONAS });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const patch = await req.json();
  const settings = await updateSettings(patch);
  return NextResponse.json({ settings });
}
