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

## Optional: HTTPS / domain

Put Caddy or Nginx in front, proxying `:3000` and terminating TLS. WebSockets must
be proxied (Socket.io upgrades on `/socket.io`). Then set `PUBLIC_URL=https://your.domain`.
HTTPS is also what makes the **PWA installable** on phones.
