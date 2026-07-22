# Deploying Syncwave

Syncwave runs as **one Docker container** (Next.js + Socket.io + yt-dlp). It is a
**stateful** app — a long-lived WebSocket server, live yt-dlp processes, and a
disk cache — so it needs a real always-on host with a persistent disk. It will
**not** run on Vercel, Netlify, Cloudflare Workers, or any serverless platform.

## Pick a path

| | [**Railway**](#option-a--railway-one-click) | [**Render**](#option-b--render-one-click) | [**Hostinger VPS**](#option-c--hostinger-vps-one-command) | [**Your own server**](#option-d--any-server-manual-docker) |
|---|---|---|---|---|
| Effort | One click | One click | One command | Manual |
| Server admin | None (managed) | None (managed) | You (root) | You |
| HTTPS | Automatic | Automatic | Automatic with a domain | You set it up |
| Free trial | **Yes — $5** | No | No | — |
| Cost after | usage-based, ~$5/mo min | ~$7/mo + disk | from ~$5/mo | Free (a spare box) |
| Best for | Trying it out today | Predictable flat pricing | Big libraries, full control | Home lab / NAS / Pi |

All four give you the same app. **Railway is the quickest start** — it has a free
trial, so you can have a working HTTPS link without entering a card. Render bills
a flat monthly rate. A VPS is cheapest per GB of audio cache, lets you supply a
YouTube cookies file, and lets you run other things on the same box.

> **Heads up on managed platforms:** Syncwave keeps room state in the server
> process, so it must run as **exactly one instance**. Don't scale it to multiple
> replicas — you'd get several disconnected copies of the same room rather than
> more capacity. Both `railway.json` and `render.yaml` already pin this.

---

## Option A — Railway (one-click)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new)

Railway gives new accounts a **$5 trial**, so this is the only path that gets you
a live HTTPS instance without a payment method.

1. Click the button → **GitHub Repository** → `SAKMZ/syncwave` (fork it first if
   you want to customise).
2. Railway reads [`railway.json`](railway.json) for the build and health check —
   and helpfully also picks up the volume mount and environment variables from
   [`render.yaml`](render.yaml), so the volume lands at `/var/syncwave` with
   `DATA_DIR` and `CACHE_DIR` already pointed into it.
3. Wait for the Docker build (a few minutes — it installs ffmpeg, python3, and
   builds Next).

You get a `https://<name>.up.railway.app` URL with HTTPS out of the box, so the
**Install app** (PWA) prompt works immediately.

**Check these after your first deploy**

- **Volume.** Confirm a volume is mounted at `/var/syncwave`, and that
  `DATA_DIR=/var/syncwave/data` and `CACHE_DIR=/var/syncwave/cache`. Without it,
  every redeploy wipes your rooms and cached audio.
- **Volume size.** Railway's default is small (500 MB ≈ 100 cached tracks). Bump
  it under the volume's **Settings → Size** if you want a deeper cache.
- **Replicas.** Leave at 1 (see the note above).
- **Trial limits.** The $5 trial expires — add a plan before you share the link
  anywhere permanent, or the instance stops.
- **Playback needs cookies here.** Railway runs on datacenter IPs, which YouTube
  bot-checks. Rooms, search, sync, and chat all work immediately, but tracks will
  fail to resolve until you supply a YouTube session — see
  [Reliability: YouTube cookies](#reliability-youtube-cookies). This is not a
  Railway fault; it applies to every cloud host.

---

## Option B — Render (one-click)

[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/SAKMZ/syncwave)

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

## Option C — Hostinger VPS (one command)

[![Deploy to Hostinger](https://img.shields.io/badge/Deploy%20to-Hostinger-673DE6?style=for-the-badge&logo=hostinger&logoColor=white)](HOSTINGER.md)

A VPS gives you root, a much bigger disk for the audio cache, a residential-ish
IP pool that yt-dlp is happier with, and room to host other things alongside it.

> **[HOSTINGER.md](HOSTINGER.md) is the full step-by-step walkthrough** — plan
> choice, DNS, HTTPS, and troubleshooting. The short version follows.

Grab a VPS (**KVM 1** — 1 vCPU / 4 GB RAM / 50 GB — is plenty for a room or two)
from [Hostinger](https://www.hostinger.com/in?REFERRALCODE=LUZAUTOMIP2T) and pick
**Ubuntu 24.04** as the OS. Then either:

### C1. Let the VPS install itself (true one-click)

In hPanel → **VPS → OS & Panel → Post-install scripts**, add the contents of
[`scripts/hostinger-post-install.sh`](scripts/hostinger-post-install.sh), then
select it when you create or reinstall the VPS. When the machine finishes
provisioning, Syncwave is already running.

Set `DOMAIN` (and `EMAIL`) at the top of that script first if you have a domain
pointed at the VPS — that gets you automatic HTTPS on first boot.

### C2. Or SSH in and run one command

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

## Option D — Any server (manual Docker)

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

## First run — claim your instance

The first time you open a new deployment, Syncwave sends you to **`/setup`** to
create an admin password, optionally upload YouTube cookies, and optionally
configure the AI DJ. Everything after that lives at **`/admin`**, behind that
password.

> **Do this immediately after deploying.** Until a password is set, anyone who
> can reach the URL can claim the instance. Listening rooms are unaffected —
> the password only guards configuration.

Lost the password? Delete `data/admin.json` on the server and reload; setup runs
again.

## Reliability: YouTube cookies

yt-dlp is frequently bot-checked from VPS/datacenter IPs ("Sign in to confirm
you're not a bot"). This is the single most common reason tracks fail to play on
a cloud host.

**The easy way — upload it in the admin console:**

1. Install a "Get cookies.txt LOCALLY" extension for Chrome or Firefox.
2. Open `youtube.com` **signed in**, and export in **Netscape** format.
3. Go to **`/admin` → YouTube access → Upload cookies.txt**.

The file is validated on upload, stored `0600` in your data directory, and picked
up on the very next track — no restart, no redeploy. It survives restarts because
it lives with the rest of the durable data.

> **Use a throwaway Google account.** A cookies file is a live login session:
> every track the server fetches is requested as that account, and heavy use can
> get it rate-limited or banned. Never put your main account on an instance other
> people can reach.

**Or supply it as a file** (takes precedence over an upload, and disables the
upload button):

- **Docker / VPS:** put it next to `docker-compose.yml` as `cookies.txt`,
  uncomment the cookies volume, set `YTDLP_COOKIES_FILE=/app/cookies.txt` in
  `.env`, then `docker compose up -d`.
- **Render:** add it as a Secret File named `cookies.txt` and set
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

---

<sub>The Hostinger links in this document are referral links — signing up through
them supports Syncwave's development at no extra cost to you. Syncwave is
MIT-licensed and runs identically on any Ubuntu host.</sub>
