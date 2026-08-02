import Link from "next/link";
import {
  Activity,
  Bot,
  Github,
  Heart,
  ListMusic,
  Lock,
  MessageSquare,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import CreateRoom from "@/components/CreateRoom";
import SiteFooter from "@/components/SiteFooter";
import Logo from "@/components/Logo";
import { isSetupComplete } from "@/lib/auth.mjs";
import { REPO_URL } from "@/lib/brand";
import pkg from "@/package.json";

export const dynamic = "force-dynamic";

/**
 * The public face of an instance.
 *
 * It has two jobs and they pull in opposite directions: explain what this is to
 * someone who arrived from a link and has never heard of it, and get someone
 * who already knows into a room in one click. So the room controls sit above
 * the fold and everything explanatory is below them — nobody who came here to
 * start a room has to read a word.
 *
 * Every surface, radius, glow and duration here comes from the design system.
 * There is no page-specific CSS.
 */

const FEATURES = [
  {
    icon: Radio,
    title: "Locked to the same second",
    body: "The server owns the clock and every listener renders their position from it, on a timebase that only moves forward. Nobody drifts, and nobody has to be told to press play.",
  },
  {
    icon: ListMusic,
    title: "A queue a room can run",
    body: "Anyone adds. Upvotes move a track one place up, once per person, so ten people beat one enthusiast. Drag to reorder works on touch, and the server confirms every move.",
  },
  {
    icon: Users,
    title: "You can tell who’s there",
    body: "Typing, queueing, voting, away. Drop off wifi and your seat is held for twelve seconds rather than announcing that you left.",
  },
  {
    icon: MessageSquare,
    title: "Chat, and a feed that isn’t chat",
    body: "Conversation stays conversation. Joins, queues and skips go to a separate activity feed instead of burying what people are saying.",
  },
  {
    icon: Bot,
    title: "An AI DJ, if you want one",
    body: "Six personas that introduce tracks in character and take requests. Bring your own provider — a local Ollama, Gemini on its free tier, OpenAI or Anthropic. Off by default, and everything works without it.",
  },
  {
    icon: ShieldCheck,
    title: "Yours, on your hardware",
    body: "One process, no database, no accounts, and no third party sitting between the room and the music. Rooms and settings are JSON files on a disk you own.",
  },
];

const STEPS = [
  { n: "01", title: "Start a room", body: "One click. No account, no sign-up, nothing to install for anyone joining." },
  { n: "02", title: "Share the link", body: "Or the six-character code. Guests open it and they’re in — phone, laptop, anything with a browser." },
  { n: "03", title: "Press play once", body: "Everyone hears the same second of the same song, and the queue is open to the whole room." },
];

export default function Home() {
  const claimed = isSetupComplete();

  return (
    <>
      <SiteHeader />

      <main className="relative">
        {/* ------------------------------------------------------------ hero */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-16 pb-20 text-center sm:pt-24">
          {/* An unclaimed server is claimable by whoever reaches it first, so say
              so rather than letting it look finished. */}
          {!claimed && (
            <Link
              href="/setup"
              className="mb-8 flex max-w-lg items-center gap-2.5 rounded-md border border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-soft px-4 py-3 text-left text-sm transition-colors duration-200 ease-[var(--ease)] hover:bg-[color-mix(in_oklab,var(--accent)_22%,transparent)]"
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

          <div className="sw-rise mb-7 flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur">
            <span className="sw-eq" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </span>
            <span className="text-xs font-semibold tracking-[0.28em] text-ink/80">
              SELF-HOSTED LISTENING ROOMS
            </span>
          </div>

          <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
            Listen together,
            <br />
            <span className="sw-gradient-text">perfectly in sync.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base text-ink/60 sm:text-lg">
            Spin up a room, share one link, and hear the same song at the same moment —
            shared queue, live chat, reactions and an optional AI DJ. No accounts, no
            subscription, running on your own machine.
          </p>

          <div className="mt-9 w-full max-w-md">
            <CreateRoom />
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
            <li>No accounts</li>
            <li aria-hidden>·</li>
            <li>No Premium requirement</li>
            <li aria-hidden>·</li>
            <li>Nobody&rsquo;s servers but yours</li>
          </ul>
        </section>

        {/* --------------------------------------------------------- product */}
        <section className="px-6 pb-24" aria-label="What a room looks like">
          <figure className="mx-auto max-w-5xl">
            <div className="sw-panel sw-glow-art overflow-hidden p-2">
              {/* A window frame, so the shot reads as an application and not as
                  decoration dropped onto the page. */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="size-2.5 rounded-full bg-white/15" aria-hidden />
                <span className="size-2.5 rounded-full bg-white/15" aria-hidden />
                <span className="size-2.5 rounded-full bg-white/15" aria-hidden />
                <span className="ml-3 truncate rounded-full bg-white/[0.04] px-3 py-1 font-mono text-[10px] text-muted">
                  /r/J94XE7
                </span>
              </div>
              {/* Plain <img>: the file is a fixed asset shipped with the app, so
                  there is nothing for the image optimiser to decide. 83 kB of
                  WebP rather than 440 kB of PNG. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/room.webp"
                width={1600}
                height={808}
                alt="A Syncwave room: album art and a waveform in the Now Playing panel, a shared queue with vote and like buttons, recommendations, a live activity feed, chat, and a bottom player with reactions"
                className="w-full rounded-md"
              />
            </div>
            <figcaption className="mt-4 text-center text-xs text-muted">
              The room adopts the dominant colour of whatever is playing.
            </figcaption>
          </figure>
        </section>

        {/* -------------------------------------------------------- features */}
        <section className="border-t border-white/6 px-6 py-24" aria-labelledby="features">
          <div className="mx-auto max-w-6xl">
            <h2 id="features" className="sw-label scroll-mt-24">
              <Sparkles className="size-3.5" aria-hidden />
              What you get
            </h2>
            <p className="mt-4 max-w-2xl font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Everything a room of people needs to run{" "}
              <span className="sw-gradient-text">one queue together.</span>
            </p>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="sw-card sw-card-hover p-6">
                  <span className="mb-5 grid size-10 place-items-center rounded-sm bg-accent-soft text-accent-2">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <h3 className="font-display text-base font-bold">{title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ----------------------------------------------------------- steps */}
        <section className="border-t border-white/6 px-6 py-24" aria-labelledby="how">
          <div className="mx-auto max-w-6xl">
            <h2 id="how" className="sw-label scroll-mt-24">
              <Activity className="size-3.5" aria-hidden />
              How it goes
            </h2>
            <p className="mt-4 max-w-2xl font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Three steps, and none of them is &ldquo;make an account&rdquo;.
            </p>

            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ n, title, body }) => (
                <li key={n} className="sw-card p-6">
                  <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent-2">
                    {n}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------------------------------- open src */}
        <section className="border-t border-white/6 px-6 py-24" aria-labelledby="open-source">
          <div className="sw-panel mx-auto flex max-w-6xl flex-col gap-8 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 id="open-source" className="sw-label scroll-mt-24">
                <Heart className="size-3.5" aria-hidden />
                Open source
              </h2>
              <p className="mt-4 font-display text-3xl leading-tight font-bold tracking-tight">
                Run your own, in about a minute.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Double-click a launcher, or one Docker command. It fetches its own Node if
                the machine hasn&rsquo;t got one, prints a public HTTPS link you can send to
                anyone, and stores everything in two folders you can back up or delete. MIT
                licensed.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[image:var(--accent-gradient)] px-[22px] py-[11px] text-[11px] font-bold tracking-[0.2em] text-white uppercase transition-[transform,box-shadow] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--glow-accent)] active:translate-y-0 active:scale-[0.97]"
                >
                  <Github className="size-3.5" aria-hidden />
                  View on GitHub
                </a>
                <a
                  href={`${REPO_URL}/blob/main/DEPLOY.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-ink px-[22px] py-[11px] text-[11px] font-bold tracking-[0.2em] text-ink uppercase transition-[background-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:bg-white/8 active:translate-y-0 active:scale-[0.97]"
                >
                  Self-host guide
                </a>
              </div>
            </div>

            <div className="w-full max-w-sm shrink-0">
              <div className="sw-card p-5">
                <p className="sw-label mb-3">Docker</p>
                <pre className="overflow-x-auto rounded-sm bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-ink-soft">
                  <code>{"cp .env.example .env\ndocker compose up -d --build"}</code>
                </pre>
                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  Data lives in <code className="font-mono text-ink-soft">./data</code> and{" "}
                  <code className="font-mono text-ink-soft">./cache</code>. Nothing else on
                  the machine is touched.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * The product bar.
 *
 * Three groups, in the order they matter: who this is, where to read about it,
 * and the two things nothing else on the page offers — the source and this
 * server's own settings. The section links are plain anchors, so the header
 * costs no JavaScript and still works before hydration.
 *
 * The version is read from package.json rather than typed here, because a
 * number maintained by hand is a number that ends up wrong.
 */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Link
          href="/"
          aria-label="Syncwave home"
          className="group flex items-center gap-2.5 rounded-sm"
        >
          <Logo size="sm" className="transition-shadow duration-200 ease-[var(--ease)] group-hover:shadow-[var(--glow-accent)]" />
          <span className="flex items-baseline gap-2">
            <span className="font-display text-sm font-extrabold tracking-[0.24em]">
              SYNCWAVE
            </span>
            <span className="rounded-full border border-white/10 px-1.5 py-px font-mono text-[10px] text-muted max-sm:hidden">
              v{pkg.version}
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label="Primary">
          <span className="mr-2 hidden items-center gap-1 md:flex">
            {[
              ["#features", "Features"],
              ["#how", "How it works"],
              ["#open-source", "Self-host"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-2 text-xs text-muted transition-colors duration-200 ease-[var(--ease)] hover:bg-white/8 hover:text-ink"
              >
                {label}
              </a>
            ))}
          </span>

          <Link
            href="/admin"
            className="rounded-full px-3 py-2 text-xs text-muted transition-colors duration-200 ease-[var(--ease)] hover:bg-white/8 hover:text-ink max-sm:hidden"
          >
            Server settings
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs text-ink transition-[background-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:bg-white/8"
          >
            <Github className="size-3.5" aria-hidden />
            <span className="max-sm:sr-only">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
