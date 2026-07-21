import Room from "@/components/Room";

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
