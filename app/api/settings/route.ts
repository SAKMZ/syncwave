import { NextRequest, NextResponse } from "next/server";
import { getPublicSettings, updateSettings } from "@/lib/settings.mjs";
import { PERSONAS } from "@/lib/personas.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: getPublicSettings(), personas: PERSONAS });
}

export async function POST(req: NextRequest) {
  const patch = await req.json();
  const settings = await updateSettings(patch);
  return NextResponse.json({ settings });
}
