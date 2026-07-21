<div align="center">

# 🌊 Syncwave

**Self-hosted, AI-powered listening rooms — your own Spotify Jam.**

Start a room, share one link, and listen with your friends **perfectly in sync** —
shared queue, live chat, floating reactions, vote-to-skip, and an optional AI DJ.
Runs anywhere Docker does.

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
- 🐳 **One-container deploy** — Next.js + realtime server + audio resolver in a
  single Docker image.

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

## Quick start (local)

```bash
cp .env.example .env       # optional: tweak PUBLIC_URL etc.
npm install
npm run dev                # http://localhost:3000
```

Requires **Node 20+** and **ffmpeg** on your PATH (yt-dlp uses it to extract audio).

## Deploy (Docker / VPS)

```bash
cp .env.example .env       # set PUBLIC_URL=https://your.domain (or http://IP:3000)
docker compose up -d --build
```

Data persists in two bind-mounts: `./data` (rooms + settings) and `./cache`
(resolved audio). Full instructions — reverse proxy / HTTPS, cookies for datacenter
IPs — are in **[DEPLOY.md](DEPLOY.md)**.

> **Reliability note:** yt-dlp is frequently bot-checked from datacenter IPs. If
> playback fails on a VPS, export a `cookies.txt` from a logged-in YouTube session,
> mount it into the container, and set `YTDLP_COOKIES_FILE=/app/cookies.txt`.

> Syncwave needs a long-lived WebSocket server, live yt-dlp processes, and a disk
> cache — so it runs on a VPS or home server, **not** on serverless platforms
> (Vercel/Netlify).

## Configuration

Copy `.env.example` to `.env`. Key settings:

| Variable             | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `PUBLIC_URL`         | Base URL used in share links (set this on any real deployment). |
| `PORT`               | Port to listen on (default `3000`).                             |
| `YTDLP_COOKIES_FILE` | Path to a YouTube `cookies.txt` (helps on datacenter IPs).      |

The **AI DJ** (provider, model, API key, persona) is configured at runtime in the
in-app **Setup** console — no restart or rebuild needed.

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
