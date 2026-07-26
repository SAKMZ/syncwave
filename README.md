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
- 🖱️ **Runs by double-clicking** — a launcher script installs, builds, and starts
  it, then prints the LAN address to share. ffmpeg and a JS runtime are bundled,
  so Node is the only prerequisite. Docker and a one-command Linux installer are
  there too.

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

1. Install [Node.js LTS](https://nodejs.org).
2. Download this repo (**Code → Download ZIP**) and unzip it.
3. **Windows:** double-click `start.bat` · **macOS/Linux:** `./start.sh`

The first run installs and builds (a few minutes); after that it starts in
seconds, opens your browser, and prints the address to share with friends on
your Wi-Fi:

```
  On this computer   http://localhost:3000
  On your network    http://192.168.1.42:3000
```

ffmpeg **and** a JavaScript runtime come bundled, so there is nothing else to
install — YouTube requires the JS runtime and refuses downloads without one.

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

> ### 🏠 Run this at home, not on a cloud host
>
> **YouTube blocks datacenter IP ranges, and cookies do not lift the block.**
> Tested on a cloud host with valid logged-in cookies, a working JS runtime, and
> all five yt-dlp player clients — every one was refused. The identical build on a
> home connection works with **no cookies at all**.
>
> That's why Syncwave targets home hosting: it just works there. On a VPS you'd
> get rooms, search, sync, and chat, but tracks would never play unless the IP is
> residential or you set `YTDLP_PROXY`. See [DEPLOY.md](DEPLOY.md).

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
| `YTDLP_PROXY`        | Proxy for all yt-dlp traffic.                                             |

The **AI DJ** (provider, model, API key, persona) is configured at runtime in the
**`/admin`** console — no restart or rebuild needed.

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
