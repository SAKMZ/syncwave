# Deploying Syncwave (self-hosted, Docker)

Syncwave runs as **one Docker container** (Next.js + Socket.io + yt-dlp). It needs
a persistent host — a VPS or home server. It is **not** deployable to Vercel or
any serverless platform (it needs a long-lived WebSocket server, yt-dlp processes,
and a persistent disk cache).

## Prerequisites on the server

- Docker + Docker Compose (`docker --version`, `docker compose version`)
- Ports: 3000 open (or put it behind a reverse proxy — see below)

## 1. Get the code onto the server

**Option A — git (best for iterating):**

```bash
# locally: push to a repo you own (GitHub/Gitea/etc.), then on the server:
git clone <your-repo-url> syncwave && cd syncwave
```

**Option B — copy directly (no git):** from your machine, in the project folder:

```bash
rsync -avz \
  --exclude node_modules --exclude .next --exclude cache \
  --exclude data --exclude _reference \
  ./ user@server:~/syncwave/
```

(`scp -r` works too — just exclude the same folders.)

## 2. Configure

```bash
cp .env.example .env
```

Set at least `PUBLIC_URL` so share links point at the server, e.g.:

```
PUBLIC_URL=http://YOUR_SERVER_IP:3000
```

## 3. Run

```bash
docker compose up -d --build
```

First build takes a few minutes (it installs deps, fetches the yt-dlp binary, and
builds Next). Then open `http://YOUR_SERVER_IP:3000`.

Useful:

```bash
docker compose logs -f       # watch logs
docker compose up -d --build # redeploy after pulling changes
docker compose down          # stop
```

Persistent data survives restarts in two bind-mounts:

- `./data` — durable rooms, settings, cache index (permanent room links live here)
- `./cache` — resolved audio (auto-evicted 72h after last play)

## Reliability note (important on datacenter IPs)

yt-dlp is frequently bot-checked from VPS/datacenter IPs ("Sign in to confirm
you're not a bot"). If playback fails:

1. Export a `cookies.txt` from a logged-in YouTube session in your browser
   (use a "Get cookies.txt" extension, Netscape format).
2. Put it next to `docker-compose.yml` as `cookies.txt`.
3. Uncomment the cookies volume + set `YTDLP_COOKIES_FILE=/app/cookies.txt` in
   `.env`, then `docker compose up -d`.

## HTTPS — required for "Install app" (PWA)

**The app-install prompt and service worker only work in a _secure context_:
HTTPS, or `http://localhost`.** Over a plain-HTTP LAN address like
`http://192.168.0.150:3000`, browsers give you no Install button and no offline
support — that's a browser rule, not a Syncwave limitation. Everything else
(rooms, sync, chat) works fine over plain HTTP; only the installable-app feature
needs HTTPS. Pick one of these to get it:

### Easiest for a home server: Tailscale Serve (free, no domain, real cert)

```bash
# once, on the server:
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# expose the container over HTTPS on your tailnet:
sudo tailscale serve --bg 3000
tailscale serve status          # shows your https://<machine>.<tailnet>.ts.net URL
```

Set `PUBLIC_URL` to that `https://…ts.net` URL and `docker compose up -d`. Anyone
on your tailnet (install the Tailscale app on the phone) can open it and **Install
app** will appear. Great for private testing.

### Public, with your own domain: Caddy (automatic Let's Encrypt)

Point a domain's DNS at the server, then a two-line `Caddyfile`:

```
your.domain {
    reverse_proxy localhost:3000
}
```

Caddy fetches a certificate automatically and proxies WebSockets out of the box.
Set `PUBLIC_URL=https://your.domain`. (Nginx works too — just make sure the
`/socket.io` upgrade headers are proxied.)

Once you're on HTTPS, opening a room shows an **Install this room** banner, and
installing it creates an app that launches straight back into that room.
