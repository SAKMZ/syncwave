<div align="center">

# 🌊 Syncwave

**Your own Spotify Jam — self-hosted, no accounts, no subscription.**

Start a room, share one link, and listen with your friends **perfectly in sync** —
shared queue, live chat, floating reactions, vote-to-skip, and an optional AI DJ.
Runs on any computer you already own.

*No accounts. No Premium requirement. Nobody's servers but yours.*

![License: MIT](https://img.shields.io/badge/License-MIT-8b5cff.svg)
![Next.js 15](https://img.shields.io/badge/Next.js-15-000000.svg?logo=next.js)
![Node 20+](https://img.shields.io/badge/Node-20%2B-3c873a.svg?logo=node.js&logoColor=white)
![Self-hosted](https://img.shields.io/badge/Self--hosted-Docker-2496ed.svg?logo=docker&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8.svg)

![Syncwave — a room playing a track, with the now-playing panel, search, shared queue and live chat](docs/room.jpg)

<sub><a href="docs/demo.gif">▶ See it in motion</a> — starting a room, searching, queueing a track, and playing it in sync.</sub>

</div>

---

## What it is

Syncwave is a small self-hosted web app for listening to music **together**. One
person spins up a room and shares the link; everyone who joins hears the same
track at the same moment. Anyone can search and add to a **shared queue**, the
room can **vote to skip**, and everyone can **chat and react** while they listen —
all on a server you control.

Think group DJ session: a house party, a long-distance movie-night-but-for-music,
a study room, a Discord community's permanent hangout.

## Features

- 🎧 **Perfectly synced playback** — a server-authoritative clock drives every
  client's audio position, so nobody drifts out of sync.
- 🔗 **One-link rooms** — create a room, share the code or URL, done. No accounts.
- ➕ **Shared queue** — anyone in the room can search and add tracks.
- 🎚️ **Familiar player** — a Spotify / YouTube-Music-style bottom player with
  **shuffle** and **repeat (off / all / one)** as shared room controls, plus
  play/pause, skip, and a scrubber. The host drives; everyone stays in sync.
- 🗳️ **Vote-to-skip** — the room decides when to move on; the host can always drive.
- 💬 **Live chat + 🎉 floating reactions** — talk and drop emoji that float up the
  screen for everyone in real time.
- 🔐 **Guided first-run setup** — a `/setup` wizard claims the instance with an
  admin password, then a password-protected `/admin` console handles YouTube
  access and the AI DJ. No config files to edit.
- 🤖 **Optional AI DJ** — an opt-in host with swappable LLM providers
  (OpenAI / Anthropic / local Ollama) and selectable personas. Degrades gracefully
  if it's off or misconfigured.
- 📌 **Permanent rooms** — rooms and settings persist across restarts, so a room
  link can live forever.
- 📱 **Installable PWA** — install a room to your home screen and it opens
  **straight back into that room** (per-room manifest), no code re-entry. Great for
  permanent community rooms. *(Install requires HTTPS — see [DEPLOY.md](DEPLOY.md).)*
- 📲 **Mobile-first UI** — a compact app shell (fixed top bar + bottom player,
  tabbed Queue / Add / Chat) that fits a phone screen, plus an aurora backdrop,
  album-art ambient glow, and glassmorphism.
- 🖱️ **Runs by double-clicking** — a launcher installs, builds, and starts it, then
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
  clock, queue, chat, and reactions. Clients render their `<audio>` position from
  the server's timestamps, so playback stays locked together.
- An audio resolver fetches each track with **yt-dlp**, caches it to disk, and
  serves it with HTTP range support. Search is powered by `ytmusic-api`.
- State is durable via simple JSON files (no database to run) — rooms and settings
  survive restarts; cached audio auto-evicts 72h after its last play.

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

[![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E.svg?style=for-the-badge&logo=railway&logoColor=white)](https://railway.com?referralCode=FNToXv)

Set one variable and playback works:

```bash
WEBSHARE_API_KEY=your-key    # or YTDLP_PROXY_LIST=http://user:pass@host:port,...
```

You can also paste either one into **`/admin`** on a running instance — no
redeploy. A [free Webshare key](https://www.webshare.io/?referral_code=iw9gooahl4ty)
gives 10 proxies and 1 GB/month.

> **Mind the bandwidth.** Tracks fetched through a proxy are capped to a lower
> bitrate — about **1.6 MB** each instead of 4.3 MB — so 1 GB is roughly **500
> tracks a month**. Plenty for a few friends; not enough for a public instance.
> Direct connections are never capped, and every track is cached for 72h, so
> repeat plays are free.
>
> *(Railway and Webshare links are referrals. They cost you nothing and the
> Railway one gives you $20 in credit.)*

## Configuration

Everything is optional — copy `.env.example` to `.env` to change any of it.

| Variable             | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `PUBLIC_URL`         | Base URL for share links. Unset = reflect the request origin (LAN-friendly). |
| `PORT`               | Port to listen on (default `3000`).                                       |
| `DATA_DIR`           | Rooms, settings, admin password, cookies (default `./data`).               |
| `CACHE_DIR`          | Downloaded audio (default `./cache`).                                     |
| `FFMPEG_PATH`        | Path to a specific ffmpeg binary. Auto-detected otherwise.                |
| `YTDLP_COOKIES_FILE` | Path to a `cookies.txt`. Takes precedence over an upload.                 |
| `WEBSHARE_API_KEY`   | Fetches a proxy pool and refreshes it hourly. Also settable in `/admin`.   |
| `YTDLP_PROXY_LIST`   | Comma-separated proxy URLs, any provider. Also settable in `/admin`.       |
| `YTDLP_PROXY`        | A single proxy, always tried first.                                       |
| `PROXY_MAX_ABR`      | Bitrate cap (kbps) for proxied downloads only. Default `96`, `0` disables. |

The **AI DJ** (provider, model, API key, persona) and the **proxy pool** are
configured at runtime in the **`/admin`** console — no restart or rebuild needed.

## Legal

Syncwave is a **self-host tool**. You run it and supply your own YouTube session;
you are responsible for how you use it in your jurisdiction. Streaming audio from
YouTube via unofficial tooling may violate YouTube's Terms of Service — do not
operate a public, for-profit service on top of it.

## Contributing

Issues and PRs are welcome. Good first areas: additional AI-DJ personas, alternative
audio sources, theming, and accessibility. If you deploy it somewhere fun, open a
discussion and say hi.

## License

[MIT](LICENSE) © 2026 Syncwave contributors
