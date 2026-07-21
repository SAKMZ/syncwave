import Link from "next/link";
import CreateRoom from "@/components/CreateRoom";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      {/* eyebrow with live equalizer */}
      <div className="mb-6 flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur">
        <span className="sw-eq" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="text-xs font-semibold tracking-[0.28em] text-ink/80">SYNCWAVE</span>
      </div>

      <h1 className="font-display text-6xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
        Listen together,
        <br />
        <span className="sw-gradient-text">perfectly in sync.</span>
      </h1>

      <p className="mt-6 max-w-xl text-lg text-ink/60">
        Spin up a room, share one link, and jam with your friends in real time — a
        shared queue, live chat, and an AI DJ. Self-hosted and entirely yours.
      </p>

      <div className="mt-9 flex flex-col items-center gap-4">
        <CreateRoom />
        <div className="flex items-center gap-5 text-sm text-ink/45">
          <span>Shared queue</span>
          <span className="size-1 rounded-full bg-ink/30" />
          <span>Live chat</span>
          <span className="size-1 rounded-full bg-ink/30" />
          <span>AI DJ</span>
        </div>
      </div>

      {/* decorative waveform */}
      <div className="mt-16 flex h-16 items-end gap-1 opacity-70" aria-hidden>
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="sw-accent-bar w-1.5 rounded-full"
            style={{
              height: `${20 + Math.abs(Math.sin(i * 0.7)) * 80}%`,
              opacity: 0.25 + Math.abs(Math.sin(i * 0.7)) * 0.6,
            }}
          />
        ))}
      </div>

      <p className="mt-10 text-sm text-ink/40">
        Have a code? Ask your host for the room link ·{" "}
        <Link href="/admin" className="text-accent-2 underline-offset-4 hover:underline">
          Setup
        </Link>
      </p>
    </main>
  );
}
