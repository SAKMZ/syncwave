# Running Syncwave

Syncwave is **self-hosted by design**. It runs on a computer you control — a
desktop, a spare laptop, a Raspberry Pi, a home server, a NAS.

> ### Why not a cloud host?
>
> **YouTube blocks datacenter IP ranges.** Tested on a cloud host with a valid
> logged-in `cookies.txt`, a working JS runtime, and all five yt-dlp player
> clients: every one was refused with *"Sign in to confirm you're not a bot."*
> The identical build on a home connection works with **no cookies at all**.
>
> Rooms, search, sync, and chat would still work on a cloud box — but tracks
> would never play, which is the whole point. So Syncwave targets home hosting,
> where it works out of the box. If you must run it on a VPS, use one with a
> residential IP or set [`YTDLP_PROXY`](#ytdlp_proxy).

## Pick how you want to run it

| | [**Desktop launcher**](#option-a--desktop-launcher-easiest) | [**Docker**](#option-b--docker-best-for-an-always-on-box) | [**Linux installer**](#option-c--one-command-linux-installer) |
|---|---|---|---|
| Best for | Trying it out, occasional listening | A machine that's always on | A dedicated Linux box |
| Setup | Double-click | Two commands | One command |
| Needs | Nothing | Docker | Ubuntu/Debian + root |
| Auto-restart | No | Yes | Yes |

---

## Option A — Desktop launcher (easiest)

No Docker, no terminal, no config files.

1. Download this repo (green **Code** button → **Download ZIP**) and unzip it.
2. Run the launcher:
   - **Windows** — double-click **`start.bat`**
   - **macOS / Linux** — `./start.sh`

There is nothing to install first. If the machine has no Node.js — or one older
than 20 — the launcher fetches an official build from `nodejs.org`, verifies it
against the published SHA-256, and unpacks it into a `.runtime` folder beside
the app. Nothing goes into your system, your PATH, or the registry, and deleting
`.runtime` reverses it. If you already have Node 20+, that one is used instead.

The first run installs dependencies and builds the app, which takes a few
minutes. After that it starts in seconds. Your browser opens automatically, and
the terminal prints an address to share:

```
  On this computer   http://localhost:3000
  On your network    http://192.168.1.42:3000
```

Anyone on the same Wi-Fi can open that network address and join. Press
**Ctrl+C** to stop.

The launcher notices when you've updated the code and rebuilds by itself. To
force a rebuild: `./start.sh --rebuild` (or `start.bat --rebuild`).

**ffmpeg** is required to convert audio, and Syncwave bundles a copy so you
normally don't have to think about it. If it warns that ffmpeg is missing,
install it with `winget install Gyan.FFmpeg` (Windows), `brew install ffmpeg`
(macOS), or `sudo apt install ffmpeg` (Linux).

---

## Option B — Docker (best for an always-on box)

```bash
git clone https://github.com/SAKMZ/syncwave.git && cd syncwave
cp .env.example .env
docker compose up -d --build
```

Then open `http://<that-machine's-IP>:3000`.

The container restarts automatically with the host. Data lives in two
bind-mounts next to `docker-compose.yml`:

- `./data` — rooms, settings, admin password, cookies (**permanent room links
  live here** — back this up if a room matters)
- `./cache` — downloaded audio, auto-evicted 72h after last play

```bash
docker compose logs -f                      # watch logs
git pull && docker compose up -d --build    # update
docker compose down                         # stop
```

Set `PUBLIC_URL` in `.env` only if you're putting it behind a domain — left
unset, Syncwave reflects whatever address you reach it on, which is what you
want on a LAN.

---

## Option C — One-command Linux installer

For a dedicated Ubuntu/Debian machine. Installs Docker, clones to
`/opt/syncwave`, builds, and starts it:

```bash
curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh | sudo bash
```

If you have a domain pointed at the machine, this also gets you automatic HTTPS
via Caddy:

```bash
curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh \
  | sudo DOMAIN=music.example.com EMAIL=you@example.com bash
```

Re-run the same command any time to update in place. It's a readable shell
script — [give it a skim](scripts/install.sh) before piping anything to `sudo`.

---

## First run — claim your instance

The first time you open Syncwave it sends you to **`/setup`** to create an admin
password, then everything else lives at **`/admin`** behind it.

> **Do this immediately.** Until a password is set, anyone who can reach the
> address can claim the instance. Listening rooms are unaffected — the password
> only guards configuration.

Lost it? Delete `data/admin.json` and reload; setup runs again.

---

## Listening from outside your home

Rooms work on your LAN with zero setup. To let friends join from elsewhere — and
to get the **Install app** (PWA) prompt, which browsers only offer over HTTPS —
pick whichever of these fits.

| | Who can join | Lasts | Setup |
|---|---|---|---|
| [**Quick tunnel**](#quick-tunnel--on-by-default) | Anyone with the link | Until you stop the server | None — it's the default |
| [**Tailscale Serve**](#tailscale-free-no-domain-real-certificate) | Only your own devices | Permanent | Install Tailscale |
| [**Tailscale Funnel**](#tailscale-free-no-domain-real-certificate) | Anyone with the link | Permanent | Install Tailscale |
| [**Your own domain**](#your-own-domain-via-caddy) | Anyone | Permanent | DNS + open ports |

Share links inside the app always use whatever address you opened it on, so all
of these work without setting `PUBLIC_URL`.

### Quick tunnel — on by default

The desktop launcher opens a **Cloudflare quick tunnel** and prints a public
HTTPS URL such as `https://reg-points-advised-course.trycloudflare.com`. No
account, no port forwarding, no domain. Send that link to anyone.

This is the default because a LAN address is no use to the people you actually
want to listen with. To stay on your own network instead:

```bash
./start.sh --local          # Windows: start.bat --local
```

**The tunnel waits until you've set an admin password.** An unclaimed instance
lets whoever reaches it first become the admin — harmless on a LAN, not harmless
on a public URL — so on first run the launcher holds the link back until you
finish `/setup` in the browser it just opened.

The tunnel closes when you stop the server and the URL differs every time, which
suits a one-off session and not a permanent room. For permanence, use an option
below.

> `cloudflared` ships with the desktop install. If it's missing, run
> `npm install cloudflared`. The Docker image doesn't include it — a server
> deployment should sit behind its own reverse proxy.

### Tailscale (free, no domain, real certificate)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale serve --bg 3000     # private: only your devices
sudo tailscale funnel --bg 3000    # public: anyone with the link
tailscale serve status             # prints your https://<machine>.<tailnet>.ts.net URL
```

**Serve** keeps it inside your tailnet — friends need Tailscale installed and an
invite to it, which is ideal for a household or a small group of regulars.
**Funnel** puts it on the public internet at the same address, so anyone with the
link can join. Either way you get a permanent name and a real certificate, with
no ports forwarded and no certificate to manage.

Optionally set `PUBLIC_URL` to that `https://…ts.net` address and restart.

> If you also run a DNS filter such as AdGuard Home or Pi-hole, add
> `[/<your-tailnet>.ts.net/]8.8.8.8` as an upstream, or its MagicDNS entry will
> shadow the public name and the link won't resolve on your own network.

### Your own domain, via Caddy

Point a domain's A record at your public IP, forward ports 80 and 443, then:

```
your.domain {
    reverse_proxy localhost:3000
}
```

Caddy fetches and renews a Let's Encrypt certificate automatically and proxies
WebSockets without extra config. Set `PUBLIC_URL=https://your.domain`.

> Exposing a home server to the internet has real consequences. Tailscale
> Funnel gives you the same HTTPS link without opening a single port, which is
> why it's the recommendation.

---

## If tracks won't play

Playback failing is almost always one of three things. The error shown in the
room names which.

**1. ffmpeg is missing.** See the note in Option A.

**2. You're being rate-limited (HTTP 429).** This happens on *any* connection,
including a home one, if you queue a lot of tracks quickly — YouTube starts
refusing requests and yt-dlp reports it as a bot-check. It is **temporary**:
wait a few minutes and it clears on its own. Syncwave tells you when this is the
cause rather than blaming your IP.

**3. YouTube is bot-checking you persistently.** Most likely on a VPS or a
shared/CGNAT connection. Upload a `cookies.txt`:

1. Install a "Get cookies.txt LOCALLY" extension for Chrome or Firefox.
2. Open `youtube.com` **while signed in** and export in **Netscape** format.
3. Go to **`/admin` → YouTube access → Upload cookies.txt**.

It's validated on upload, stored `0600` in your data directory, and used from
the very next track — no restart.

> **Use a throwaway Google account.** The file is a live login session: every
> track the server fetches is requested as that account, and heavy use can get
> it rate-limited or banned. Never put your main account on an instance other
> people can reach.

**4. Your IP range is blocked outright.** Cookies won't help — see the note at
the top. Use a residential connection, or a proxy:

<a id="ytdlp_proxy"></a>

```
YTDLP_PROXY=http://user:pass@residential-proxy.example:8000
```

---

## Configuration reference

Everything is optional. Copy `.env.example` to `.env` to change any of it.

| Variable | What it does |
| --- | --- |
| `PUBLIC_URL` | Base URL for share links. Unset = reflect the request origin (right for a LAN). |
| `PORT` | Port to listen on (default `3000`). |
| `DATA_DIR` | Rooms, settings, admin password, cookies (default `./data`). |
| `CACHE_DIR` | Downloaded audio (default `./cache`). |
| `FFMPEG_PATH` | Path to a specific ffmpeg binary. Auto-detected otherwise. |
| `YTDLP_COOKIES_FILE` | Path to a `cookies.txt`. Takes precedence over an upload and disables the upload button. |
| `YTDLP_PROXY` | Proxy for all yt-dlp traffic. |

The **AI DJ** (provider, model, API key, persona) is configured at runtime in
the **`/admin`** console — no restart, no rebuild.
