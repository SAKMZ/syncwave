<div align="center">

# 🌊 Syncwave

**A self-hosted Spotify Jam alternative — listen to music together, in perfect sync, with no accounts and no Premium.**

Start a room, share one link, and everyone hears the same second of the same
song. Shared queue, live chat, floating reactions, vote-to-skip, session
history, and an optional AI DJ. Runs on any computer you already own.

*No accounts. No subscription. Nobody's servers but yours.*

![License: MIT](https://img.shields.io/badge/License-MIT-8b5cff.svg)
![Next.js 15](https://img.shields.io/badge/Next.js-15-000000.svg?logo=next.js)
![Node 20+](https://img.shields.io/badge/Node-20%2B-3c873a.svg?logo=node.js&logoColor=white)
![Self-hosted](https://img.shields.io/badge/Self--hosted-Docker-2496ed.svg?logo=docker&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8.svg)

![Syncwave, a self-hosted Spotify Jam alternative: a listening room in a dark purple interface, with a Now Playing hero showing album art and a waveform, a shared queue with vote and like buttons, recommendations, a live activity feed, chat, and a bottom player with reactions](docs/room-live.png)

</div>

---

## What it is

Syncwave is a small self-hosted web app for **listening to music together**. One
person spins up a room and shares the link; everyone who joins hears the same
track at the same moment. Anyone can search and add to a **shared queue**, the
room can **vote to skip**, and everyone can **chat and react** while they listen —
all on a server you control.

Think group DJ session: a house party, a long-distance listening party, a study
room, a Discord community's permanent hangout.

**If you've looked for a Spotify Jam alternative**, or missed
[JQBX](https://jqbx.fm), Vertigo, Turntable.fm or plug.dj, this is that idea
without the account requirement, the Premium subscription, or somebody else's
servers deciding when to shut it down. Nobody in the room needs to pay for
anything, and nobody needs the same music service as you.

## Features

### Listening together

- 🎧 **Perfectly synced playback** — a server-authoritative clock on a monotonic
  timebase drives every client's audio position, so nobody drifts and an NTP
  correction can't jolt the room.
- 🔗 **One-link rooms** — create a room, share the code or URL, done. No accounts.
- 🎚️ **Familiar player** — a bottom player with **shuffle** and **repeat
  (off / all / one)** as shared room controls, plus play/pause, skip and a
  scrubber. The host drives; everyone stays in sync.
- 🗳️ **Vote-to-skip** — the room decides when to move on; the host can always drive.
- 📌 **Permanent rooms** — rooms and settings persist across restarts, so a room
  link can live forever.

### A queue people can actually run

- ➕ **Shared queue** — anyone can search and add. Every track shows its art,
  artist, duration, who added it and when.
- ⬆️ **Upvotes that do something** — a vote moves a track **one place up the
  queue**, per person. Ten people wanting the same song move it ten places; one
  enthusiast can't jump the room.
- ❤️ **Likes** — per-person, persistent, and they feed the session stats.
- ✋ **Drag to reorder** — pointer-based, so it works on touch, and arrow keys on
  the grip do the same thing. Reordering is server-confirmed, so two people
  dragging at once converge instead of fighting.
- 🕘 **Session history** — everything the room has played, who added it, how long
  it ran, and whether it got skipped.
- 📊 **Session stats** — tracks played, time listened, most-liked track, top
  contributor, who's still here.

### A room that feels occupied

- 🟢 **Live presence** — see who's *typing*, *queueing*, *voting*, *away* or
  *reconnecting*, and open anyone's card for how long they've been here and what
  they've added. A phone locking mid-song holds its seat for 12 seconds instead
  of announcing a departure.
- 💬 **Chat** — grouped messages, avatars, quick emoji, and nothing else in it.
  Joins, queues and skips live in a separate **activity feed** so the
  conversation isn't buried under bookkeeping.
- 🎉 **Reactions** — six emoji with five distinct animations (hearts, sparks,
  confetti, bounce, sparkles). Each burst is generated from the event's own seed,
  so **every browser in the room draws the identical burst**.
- 🌡️ **Room mood** — Party, Gaming, Melancholy, Late Night, Study or Chill,
  inferred from what the room is actually doing over a rolling ten minutes. Click
  the badge and it tells you why it thinks so.
- 🎨 **The room takes its colour from the album art** — the dominant tone of the
  current cover is sampled and tinted through the whole interface, so it shifts
  with the music.

### Finding something to play

- 🔎 **Search songs, albums and artists** — three tabs over one endpoint, with
  instant results, arrow-key navigation, and album drill-down with **Add all**.
- ✨ **Recommendations** — a *More like this* panel that names its own basis
  (the DJ's pick, or more from the current artist) rather than asking you to
  trust an unexplained list.
- 🤖 **Optional AI DJ** — an opt-in host with swappable LLM providers
  (OpenAI / Anthropic / local Ollama) and **six personas**: Late Night FM, Vinyl
  Collector, Lo-Fi Host, Indie Explorer, Synthwave Radio and Jazz Lounge. It
  introduces tracks in character and takes requests with `/dj <what you want>` in
  chat. Taste and voice are kept separate on purpose — ask the Jazz Lounge host
  for a specific pop song and you get *that song*, introduced in their voice.
  Degrades gracefully if it's off or misconfigured.

### The rest of the craft

- ⌨️ **Keyboard shortcuts** — `Space` play/pause, `J`/`L` seek and skip, `/` or
  `⌘K` search, `Q` queue, `C` chat, `H` history, `F` like, `M` mute, `?` for the
  full list.
- 📱 **Built for a phone, not shrunk onto one** — tabbed panes, swipe between
  them, bottom sheets instead of popovers, and everything you press often inside
  the thumb band above the player.
- ♿ **Accessible** — focus rings on everything interactive, live regions
  announcing the current track, keyboard parity for drag-reorder, and both
  `prefers-reduced-motion` and `prefers-contrast: more` honoured.
- 🔐 **Guided first-run setup** — a `/setup` wizard claims the instance with an
  admin password, then a password-protected `/admin` console handles YouTube
  access and the AI DJ. No config files to edit.
- 📲 **Installable PWA** — install a room to your home screen and it opens
  **straight back into that room** (per-room manifest), no code re-entry. Great
  for permanent community rooms. *(Install requires HTTPS — see [DEPLOY.md](DEPLOY.md).)*
- 🖱️ **Runs by double-clicking** — a launcher installs, builds and starts it, then
  prints the address to share. **Nothing to install first:** it fetches its own
  Node if you don't have one, and ffmpeg and a JS runtime come bundled. Docker and
  a one-command Linux installer are there too.
- 🌍 **A shareable link out of the box** — the launcher prints a public HTTPS URL
  via a Cloudflare quick tunnel, so friends anywhere can join. No account, no port
  forwarding, no domain. `--local` keeps it on your network; Tailscale and
  your-own-domain setups are documented for permanent addresses.

## How it works

- A **Next.js** front end (App Router, React 19) is the room UI and installable PWA.
- A custom **Socket.io** server is the single source of truth for the playback
  clock, queue, chat, presence and reactions. Clients render their `<audio>`
  position from the server's timestamps, so playback stays locked together.
- An audio resolver fetches each track with **yt-dlp**, caches it to disk, and
  serves it with HTTP range support. Search is powered by `ytmusic-api`.
- State is durable via simple JSON files (no database to run) — rooms and settings
  survive restarts; cached audio auto-evicts 72h after its last play, under a
  disk cap.

It all runs in **one process / one container**.

## Get it running

### Easiest — double-click a file

1. Download this repo (**Code → Download ZIP**) and unzip it.
2. **Windows:** double-click `start.bat` · **macOS/Linux:** `./start.sh`

That's the whole list — there is no step 0. If the machine has no Node.js (or
one older than 20), the launcher downloads an official copy from `nodejs.org`,
checks it against the published SHA-256, and keeps it in a `.runtime` folder
beside the app. Nothing is installed system-wide, no PATH or registry changes,
and deleting `.runtime` undoes it. An existing Node 20+ is used as-is.

ffmpeg **and** a JavaScript runtime come bundled too — YouTube refuses downloads
without a JS runtime, so that one isn't optional.

The first run installs and builds (a few minutes); after that it starts in
seconds and opens your browser:

```
  On this computer   http://localhost:3000
  On your network    http://192.168.1.42:3000
```

### Your friends aren't on your Wi-Fi, so you also get a public link

On first run it asks you to set an admin password, then prints a shareable
HTTPS link:

```
  Share this link    https://reg-points-advised-course.trycloudflare.com
```

Send that to anyone, anywhere. It's a **Cloudflare quick tunnel** — no account,
no port forwarding, no domain, nothing to configure. Because it's HTTPS, the
**Install app** prompt works on phones too. The URL is random and disappears
when you stop the server.

> **The link is public**, so the launcher won't open one until you've set an
> admin password — otherwise the first stranger to find the URL could claim your
> instance. Prefer to stay on your own network? Use `--local`.

For a **permanent** address, or one only your own devices can reach, use
**Tailscale** — see [DEPLOY.md](DEPLOY.md).

### Always-on box — Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Data persists in `./data` (rooms + settings) and `./cache` (audio).

### Dedicated Linux server — one command

```bash
curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh | sudo bash
```

**Everything else** — listening from outside your home over HTTPS via Tailscale,
the first-run setup, and troubleshooting — is in **[DEPLOY.md](DEPLOY.md)**.

### For development

```bash
npm install
npm run dev                # http://localhost:3000
```

### First run

Syncwave sends you to **`/setup`** to create an admin password, then everything
else lives at **`/admin`** behind it. **Do this right away** — until a password is
set, anyone who can reach the address can claim the instance. Listening rooms are
unaffected; the password only guards configuration.

### Cloud host — works, with a proxy pool

Home is still the path of least resistance: it works with no configuration at
all. But a cloud VPS is workable now, and here is the honest version of why.

**YouTube refuses most datacenter IPs, and cookies do not lift it.** Tested on a
cloud host with valid logged-in cookies, a working JS runtime, and all five
yt-dlp player clients — every one refused. The identical build at home works
with **no cookies at all**.

The refusal is not uniform, though. Measured from one cloud instance: every
direct attempt refused, while **4 of 10** commodity proxies fetched the same
track fine. So Syncwave tries direct first and only falls back through a pool
when the IP is refused, remembering which proxies worked.

[![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E.svg?style=for-the-badge&logo=railway&logoColor=white)](DEPLOY.md#option-d--railway)

**[Step-by-step Railway guide →](DEPLOY.md#option-d--railway)** — repo to
listening room in about ten minutes. It's a short guide because two steps are
easy to miss: attach a volume *before* first boot, or your admin password and
rooms vanish on the next redeploy; and configure a proxy pool, or nothing plays.

Set one variable and playback works:

```bash
WEBSHARE_API_KEY=your-key    # or YTDLP_PROXY_LIST=http://user:pass@host:port,...
```

You can also paste either one into **`/admin`** on a running instance — no
redeploy. A [free Webshare key](https://www.webshare.io/?referral_code=iw9gooahl4ty)
gives 10 proxies and 1 GB/month.

> **Mind the bandwidth.** Tracks fetched through a proxy are capped to a lower
> bitrate — about **1.6 MB** each instead of 4.3 MB. Measured end to end a track
> costs ~2.7 MB once metadata and protocol overhead are counted, so 1 GB is
> roughly **350–400 tracks a month**. Plenty for a few friends; not enough for a
> public instance. Direct connections are never capped, and every track is cached
> for 72h, so repeat plays are free.
>
> *(Railway and Webshare links are referrals. They cost you nothing and the
> Railway one gives you $20 in credit.)*

## Keyboard shortcuts

Press <kbd>?</kbd> in a room for this list without leaving the page.

| | |
| --- | --- |
| <kbd>Space</kbd> | Play / pause *(host)* |
| <kbd>J</kbd> / <kbd>L</kbd> | Back 10 seconds / next track *(host)* |
| <kbd>M</kbd> | Mute |
| <kbd>/</kbd> or <kbd>⌘K</kbd> | Search |
| <kbd>Q</kbd> · <kbd>C</kbd> · <kbd>H</kbd> | Queue · chat · history |
| <kbd>F</kbd> | Like the current track |
| <kbd>Esc</kbd> | Close whatever is open |

## Configuration

Everything is optional — copy `.env.example` to `.env` to change any of it.

| Variable             | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `PUBLIC_URL`         | Base URL for share links. Unset = reflect the request origin (LAN-friendly). |
| `PORT`               | Port to listen on (default `3000`).                                       |
| `DATA_DIR`           | Rooms, settings, admin password, cookies (default `./data`).               |
| `CACHE_DIR`          | Downloaded audio (default `./cache`).                                     |
| `CACHE_MAX_MB`       | Disk cap for cached audio (default `4096`). Oldest evicted first, `0` = no cap. |
| `FFMPEG_PATH`        | Path to a specific ffmpeg binary. Auto-detected otherwise.                |
| `YTDLP_COOKIES_FILE` | Path to a `cookies.txt`. Takes precedence over an upload.                 |
| `WEBSHARE_API_KEY`   | Fetches a proxy pool and refreshes it hourly. Also settable in `/admin`.   |
| `YTDLP_PROXY_LIST`   | Comma-separated proxy URLs, any provider. Also settable in `/admin`.       |
| `YTDLP_PROXY`        | A single proxy, always tried first.                                       |
| `PROXY_MAX_ABR`      | Bitrate cap (kbps) for proxied downloads only. Default `96`, `0` disables. |

The **AI DJ** (provider, model, API key, persona) and the **proxy pool** are
configured at runtime in the **`/admin`** console — no restart or rebuild needed.

## Questions people actually ask

**Does everyone need Spotify, or Spotify Premium?**
No. Nobody needs an account with anything. Audio is resolved server-side and
streamed from your instance, so listeners just open a link.

**Does it work on phones?**
Yes, and it's designed for them rather than reflowed onto them. Install a room
to the home screen and it reopens straight into that room.

**How many people can be in a room?**
There's no built-in cap. The practical limit is your upstream bandwidth: each
listener streams the track from your machine. A handful of friends on a home
connection is comfortable.

**Can I run it alongside Discord?**
That's the common setup — voice in Discord, music in a Syncwave room everyone
has open. Unlike a music bot, everyone hears it at full quality and can queue,
vote and see what's playing.

**Is it a Discord music bot / Watch2Gether / Teleparty for music?**
Same idea, different shape: a web room you host yourself, with a real queue and
a real player rather than a bot's text commands.

**Does the AI DJ have to be on?**
No. It's off by default and everything else works without it — Syncwave never
calls an LLM provider until you configure one yourself, and the key stays on
your instance.

**Where does the music come from?**
YouTube Music, fetched with yt-dlp and cached on your disk. See *Legal* below.

**Which browsers does the room need?**
Anything from 2023 onward — Chrome/Edge 111+, Safari 16.4+, Firefox 113+. The
interface leans on `color-mix()`, `oklab` and `dvh`, so a browser older than that
will render it, but with the wrong colours in places.

## Legal

Syncwave is a **self-host tool**. You run it and supply your own YouTube session;
you are responsible for how you use it in your jurisdiction. Streaming audio from
YouTube via unofficial tooling may violate YouTube's Terms of Service — do not
operate a public, for-profit service on top of it.

## Contributing

Issues and PRs are welcome. Good first areas: additional AI-DJ personas,
alternative audio sources, theming, and accessibility. If you deploy it somewhere
fun, open a discussion and say hi.

## License

[MIT](LICENSE) © 2026 Syncwave contributors
