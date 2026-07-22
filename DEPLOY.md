# Deploying Syncwave

Syncwave runs as **one Docker container** (Next.js + Socket.io + yt-dlp). It is a
**stateful** app — a long-lived WebSocket server, live yt-dlp processes, and a
disk cache — so it needs a real always-on host with a persistent disk. It will
**not** run on Vercel, Netlify, Cloudflare Workers, or any serverless platform.

## Pick a path

| | [**Render**](#option-a--render-one-click) | [**Hostinger VPS**](#option-b--hostinger-vps-one-command) | [**Your own server**](#option-c--any-server-manual-docker) |
|---|---|---|---|
| Effort | One click | One command | Manual |
| Server admin | None (managed) | You (root) | You |
| HTTPS | Automatic | Automatic with a domain | You set it up |
| Cost | ~$7/mo + disk | from ~$5/mo | Free (a spare box) |
| Best for | Trying it out, small rooms, zero-ops | Big libraries, many rooms, full control | Home lab / NAS / Pi |

Both hosted paths give you the same app. Render is the fastest way to get a
working HTTPS link; a VPS is cheaper per GB of audio cache, lets you supply a
YouTube cookies file, and lets you run other things on the same box.

---

## Option A — Render (one-click)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/SAKMZ/syncwave)

1. Click the button (fork the repo first if you want to customise it, then point
   the button at your fork).
2. Render reads [`render.yaml`](render.yaml) and provisions the service, the
   persistent disk, and HTTPS for you.
3. Click **Apply**. The first build takes a few minutes.

You get a `https://<name>.onrender.com` URL that is HTTPS out of the box — so the
**Install app** (PWA) prompt works immediately.

**What the blueprint sets up**

- A `starter` web service built from the repo `Dockerfile`.
- A **5 GB persistent disk** at `/var/syncwave`, with `DATA_DIR` and `CACHE_DIR`
  pointed into it — rooms, settings, and cached audio survive deploys.
- A health check on `/api/health`.
- `PUBLIC_URL` is left unset on purpose: the server falls back to
  `RENDER_EXTERNAL_URL`, which Render injects with the real URL.

**Things to know**

- **A paid instance is required.** Render's free instances have no persistent
  disk and spin down when idle, which would drop every listener and wipe every
  room. The blueprint pins `plan: starter` for that reason.
- **Disk size and region.** Edit `render.yaml` before deploying — bump `sizeGB`
  if you want a bigger audio cache, and add e.g. `region: singapore` to the
  service to run closer to your listeners.
- **yt-dlp and datacenter IPs.** Render runs on cloud IPs, which YouTube
  bot-checks more aggressively. If playback starts failing, see
  [Reliability: YouTube cookies](#reliability-youtube-cookies) — on Render you
  add the cookies as a Secret File and set `YTDLP_COOKIES_FILE` to its path.

---

## Option B — Hostinger VPS (one command)

A VPS gives you root, a much bigger disk for the audio cache, a residential-ish
IP pool that yt-dlp is happier with, and room to host other things alongside it.

<!-- affiliate-link -->
Grab a VPS (**KVM 1** — 1 vCPU / 4 GB RAM / 50 GB — is plenty for a room or two)
from [Hostinger](https://www.hostinger.com/vps-hosting) and pick **Ubuntu 24.04**
as the OS. Then either:

### B1. Let the VPS install itself (true one-click)

In hPanel → **VPS → OS & Panel → Post-install scripts**, add the contents of
[`scripts/hostinger-post-install.sh`](scripts/hostinger-post-install.sh), then
select it when you create or reinstall the VPS. When the machine finishes
provisioning, Syncwave is already running.

Set `DOMAIN` (and `EMAIL`) at the top of that script first if you have a domain
pointed at the VPS — that gets you automatic HTTPS on first boot.

### B2. Or SSH in and run one command

```bash
curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh | sudo bash
```

With a domain (recommended — this is what enables the installable PWA):

```bash
curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh \
  | sudo DOMAIN=music.example.com EMAIL=you@example.com bash
```

The script installs Docker, clones Syncwave to `/opt/syncwave`, writes `.env`,
installs **Caddy** for automatic Let's Encrypt HTTPS when you pass `DOMAIN`,
opens the firewall, builds, and waits for the health check. Re-running it updates
an existing install in place.

```bash
cd /opt/syncwave
docker compose logs -f          # watch logs
git pull && docker compose up -d --build   # update
docker compose down             # stop
```

---

## Option C — Any server (manual Docker)

Works on any machine with Docker — another VPS provider, a home server, a NAS.

```bash
git clone https://github.com/SAKMZ/syncwave.git && cd syncwave
cp .env.example .env
# set PUBLIC_URL=https://your.domain  (or http://YOUR_SERVER_IP:3000)
docker compose up -d --build
```

Persistent data lives in two bind-mounts next to `docker-compose.yml`:

- `./data` — rooms, settings, cache index (permanent room links live here)
- `./cache` — resolved audio (auto-evicted 72h after last play)

```bash
docker compose logs -f       # watch logs
docker compose up -d --build # redeploy after pulling changes
docker compose down          # stop
```

---

## HTTPS — required for "Install app" (PWA)

**The app-install prompt and service worker only work in a _secure context_:
HTTPS, or `http://localhost`.** Over a plain-HTTP LAN address like
`http://192.168.0.150:3000`, browsers give you no Install button and no offline
support — that's a browser rule, not a Syncwave limitation. Everything else
(rooms, sync, chat) works fine over plain HTTP.

Render (Option A) and the installer's `DOMAIN=` mode (Option B) both handle this
for you. Otherwise:

### With your own domain: Caddy (automatic Let's Encrypt)

Point a domain's DNS at the server, then a two-line `Caddyfile`:

```
your.domain {
    reverse_proxy localhost:3000
}
```

Caddy fetches a certificate automatically and proxies WebSockets out of the box.
Set `PUBLIC_URL=https://your.domain`. (Nginx works too — just make sure the
`/socket.io` upgrade headers are proxied.)

### No domain, home server: Tailscale (free, real cert)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale serve --bg 3000    # tailnet-only
# or, to share it publicly:
sudo tailscale funnel --bg 3000
tailscale serve status            # prints your https://<machine>.<tailnet>.ts.net URL
```

Set `PUBLIC_URL` to that `https://…ts.net` URL and `docker compose up -d`.

Once you're on HTTPS, opening a room shows an **Install this room** banner, and
installing it creates an app that launches straight back into that room.

---

## Reliability: YouTube cookies

yt-dlp is frequently bot-checked from VPS/datacenter IPs ("Sign in to confirm
you're not a bot"). If playback fails:

1. Export a `cookies.txt` from a logged-in YouTube session in your browser
   (use a "Get cookies.txt" extension, Netscape format).
2. **Docker / VPS:** put it next to `docker-compose.yml` as `cookies.txt`,
   uncomment the cookies volume, set `YTDLP_COOKIES_FILE=/app/cookies.txt` in
   `.env`, then `docker compose up -d`.
3. **Render:** add it as a Secret File named `cookies.txt` and set
   `YTDLP_COOKIES_FILE=/etc/secrets/cookies.txt` in the service's environment.

## Configuration reference

| Variable | What it does |
| --- | --- |
| `PUBLIC_URL` | Base URL of the instance. Falls back to `RENDER_EXTERNAL_URL`, then to reflecting the request origin. |
| `PORT` | Port to listen on (default `3000`). |
| `DATA_DIR` | Where rooms/settings JSON lives (default `./data`). |
| `CACHE_DIR` | Where resolved audio is cached (default `./cache`). |
| `YTDLP_COOKIES_FILE` | Path to a YouTube `cookies.txt`. |

The **AI DJ** (provider, model, API key, persona) is configured at runtime in the
in-app **Setup** console — no restart or rebuild needed.
