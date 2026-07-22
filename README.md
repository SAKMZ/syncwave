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

[![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](DEPLOY.md#option-a--railway-one-click)
[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/SAKMZ/syncwave)
[![Deploy to Hostinger](https://img.shields.io/badge/Deploy%20to-Hostinger-673DE6?style=for-the-badge&logo=hostinger&logoColor=white)](HOSTINGER.md)

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

## Deploy

Syncwave is **stateful** — a long-lived WebSocket server, live yt-dlp processes,
and a disk cache — so it needs an always-on host with a persistent disk. It does
**not** run on Vercel, Netlify, or any serverless platform. Two easy paths:

### 🚂 Fastest start — Railway (free $5 trial)

[![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.com/new)

The only path that gets you a live HTTPS instance **without entering a card**.
Click → **GitHub Repository** → `SAKMZ/syncwave`. Railway reads
[`railway.json`](railway.json) and picks up the volume and env vars from
[`render.yaml`](render.yaml) automatically.
**[Full steps + what to check afterwards →](DEPLOY.md#option-a--railway-one-click)**

### 🚀 One click — Render

[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/SAKMZ/syncwave)

Render reads [`render.yaml`](render.yaml) and provisions the container, a
persistent disk, and HTTPS for you. You get a `https://…onrender.com` link where
**Install app** works right away. Needs a paid instance (~$7/mo) — free instances
have no disk and sleep when idle, which would drop everyone in the room.

### 🖥️ One command — your own VPS

[![Deploy to Hostinger](https://img.shields.io/badge/Deploy%20to-Hostinger-673DE6?style=for-the-badge&logo=hostinger&logoColor=white)](HOSTINGER.md)

More control, a much bigger audio cache, and cheaper as you grow. On any fresh
Ubuntu box:

```bash
curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh | sudo bash
```

Add `DOMAIN=music.example.com EMAIL=you@example.com` to also get automatic HTTPS
via Caddy. The installer handles Docker, the build, the reverse proxy, and the
certificate — and re-running it updates in place.

**[Full VPS walkthrough → HOSTINGER.md](HOSTINGER.md)** — including a
[post-install script](scripts/hostinger-post-install.sh) that provisions the VPS
with Syncwave already running, so you never have to SSH in at all.

### 🐳 Anywhere else — Docker

```bash
cp .env.example .env       # set PUBLIC_URL=https://your.domain (or http://IP:3000)
docker compose up -d --build
```

Data persists in two bind-mounts: `./data` (rooms + settings) and `./cache`
(resolved audio).

**Full instructions** — reverse proxies, HTTPS, Tailscale, and YouTube cookies for
datacenter IPs — are in **[DEPLOY.md](DEPLOY.md)**.

### After deploying

Open your instance and it walks you through **`/setup`** — set an admin password,
optionally upload a YouTube `cookies.txt`, optionally switch on the AI DJ. **Do
this right away:** until a password is set, anyone who can reach the URL can claim
it. Rooms themselves are unaffected; the password only guards configuration.

> ### ⚠️ Where you host this decides whether music actually plays
>
> **YouTube blocks datacenter IPs, and cookies do not lift the block.** Verified
> on Railway with valid logged-in cookies, a working JS runtime, and all five
> yt-dlp player clients — every one was refused. The same build on a home
> connection works with no cookies at all.
>
> - **Home server or residential-IP VPS** → playback works. This is the intended
>   way to run Syncwave.
> - **Railway / Render / big-cloud VPS** → rooms, search, sync, and chat all work,
>   but tracks will not resolve unless you set `YTDLP_PROXY` to a residential
>   proxy.
>
> A `cookies.txt` (uploaded at **`/admin` → YouTube access**) still helps on
> borderline connections. Use a **throwaway Google account** — the file is a live
> login session and every track the server fetches is attributed to it. Details in
> [DEPLOY.md](DEPLOY.md).

## Configuration

Copy `.env.example` to `.env`. Key settings:

| Variable             | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| `PUBLIC_URL`         | Base URL of the instance. Falls back to `RENDER_EXTERNAL_URL` on Render.     |
| `PORT`               | Port to listen on (default `3000`).                                          |
| `DATA_DIR`           | Where rooms/settings JSON lives (default `./data`).                          |
| `CACHE_DIR`          | Where resolved audio is cached (default `./cache`).                          |
| `YTDLP_COOKIES_FILE` | Path to a YouTube `cookies.txt` (helps on datacenter IPs).                   |

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
