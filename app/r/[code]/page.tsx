import type { Metadata } from "next";
import Room from "@/components/Room";

// Per-room manifest (server-rendered, so the browser reads it on first load):
// installing from a room produces an app whose start_url IS that room, so
// guests reopen straight into it. Overrides the global manifest from layout.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  return {
    title: `Syncwave · Room ${upper}`,
    manifest: `/api/room-manifest?code=${upper}`,
  };
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ host?: string }>;
}) {
  const { code } = await params;
  const { host } = await searchParams;
  return <Room code={code.toUpperCase()} asHost={host === "1"} />;
}
