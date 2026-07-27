import Link from "next/link";
import { ListMusic, MessageSquare, Bot, ShieldCheck, Lock } from "lucide-react";
import CreateRoom from "@/components/CreateRoom";
import MadeWithLove from "@/components/MadeWithLove";
import { isSetupComplete } from "@/lib/auth.mjs";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: ListMusic, label: "Shared queue" },
  { icon: MessageSquare, label: "Live chat" },
  { icon: Bot, label: "AI DJ" },
  { icon: ShieldCheck, label: "Self-hosted" },
];

export default function Home() {
  const claimed = isSetupComplete();

  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      {/* An unclaimed server is claimable by whoever reaches it first, so say so
          rather than letting it look finished. */}
      {!claimed && (
        <Link
          href="/setup"
          className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-soft px-4 py-3 text-left text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_22%,transparent)]"
        >
          <Lock className="size-4 shrink-0 text-accent-2" />
          <span>
            <span className="font-semibold text-ink">This server isn&rsquo;t set up yet.</span>{" "}
            <span className="text-muted">
              Set an admin password to secure it — and to get a shareable link.
            </span>
          </span>
        </Link>
      )}

      {/* eyebrow with live equalizer */}
      <div className="mb-7 flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur">
        <span className="sw-eq" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="text-xs font-semibold tracking-[0.28em] text-ink/80">SYNCWAVE</span>
      </div>

      <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
        Listen together,
        <br />
        <span className="sw-gradient-text">perfectly in sync.</span>
      </h1>

      <p className="mt-6 max-w-xl text-base text-ink/60 sm:text-lg">
        Spin up a room, share one link, and hear the same song at the same moment —
        shared queue, live chat, and an optional AI DJ. No accounts, no subscription,
        running on your own machine.
      </p>

      <div className="mt-9 w-full max-w-md">
        <CreateRoom />
      </div>

      <ul className="mt-10 flex flex-wrap items-center justify-center gap-2">
        {FEATURES.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-ink/60"
          >
            <Icon className="size-3.5 text-accent-2" />
            {label}
          </li>
        ))}
      </ul>

      {/* decorative waveform */}
      <div className="mt-14 flex h-14 w-full max-w-lg items-end justify-center gap-1" aria-hidden>
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="sw-accent-bar w-1.5 rounded-full"
            style={{
              height: `${20 + Math.abs(Math.sin(i * 0.7)) * 80}%`,
              opacity: 0.2 + Math.abs(Math.sin(i * 0.7)) * 0.5,
            }}
          />
        ))}
      </div>

      <footer className="mt-12 flex flex-col items-center gap-3">
        <p className="text-sm text-ink/40">
          <Link href="/admin" className="text-accent-2 underline-offset-4 hover:underline">
            Server settings
          </Link>
        </p>

        <MadeWithLove />
      </footer>
    </main>
  );
}
