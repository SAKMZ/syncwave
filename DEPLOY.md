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
> The block is not uniform, though: from one cloud instance every direct attempt
> was refused while **4 of 10** commodity proxies fetched the same track fine. So
> a VPS does work — point Syncwave at a [proxy pool](#ytdlp_proxy) and it tries
> direct first, falling back only when refused.
>
> Home hosting is still the path of least resistance, because it needs no
> configuration and has no bandwidth ceiling.

## Pick how you want to run it

| | [**Desktop launcher**](#option-a--desktop-launcher-easiest) | [**Docker**](#option-b--docker-best-for-an-always-on-box) | [**Linux installer**](#option-c--one-command-linux-installer) | [**Railway**](#option-d--railway) |
|---|---|---|---|---|
| Best for | Trying it out, occasional listening | A machine that's always on | A dedicated Linux box | No hardware to spare |
| Setup | Double-click | Two commands | One command | Web UI, ~10 min |
| Needs | Nothing | Docker | Ubuntu/Debian + root | A card, and a proxy pool |
| Auto-restart | No | Yes | Yes | Yes |
| Plays music | Out of the box | Out of the box | Out of the box | **Only with a [proxy pool](#ytdlp_proxy)** |
| Cost | Free | Free | Free | ~$5/mo after trial |

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

<a id="option-d--railway"></a>

## Option D — Railway (cloud, no hardware)

Use this when you have no machine to leave running. It is the only option where
**playback does not work out of the box** — Railway runs on datacenter IPs, so
you must configure a [proxy pool](#ytdlp_proxy) or every track will fail.

> **Do step 4 before you open the app.** Without it you get rooms, search, sync
> and chat, and every track returns "Sign in to confirm you're not a bot."

**Cost:** the trial credit covers roughly a month; after that it's the Hobby plan
(~$5/mo) plus a few cents for the volume. [Sign-up link](https://railway.com?referralCode=FNToXv)
— a referral, which gives you $20 in credit.

### 1. Create the service

1. [**New Project → Deploy from GitHub repo**](https://railway.com/new), and pick
   your fork of this repo (fork it first if you want to control when it updates).
2. Railway detects the `Dockerfile` on its own. No build config needed.
3. The first build takes a few minutes — it compiles the app and fetches ffmpeg
   and a JS runtime.

### 2. Add a volume — do this before the first successful boot

Rooms, settings, your admin password and cached audio all live on disk. Without
a volume they are wiped on every redeploy.

**Service → Variables → + Volume**, mount path:

```
/var/syncwave
```

Railway allows one volume per service, so both directories live inside it.

### 3. Set the variables

**Service → Variables**:

| Variable | Value |
| --- | --- |
| `DATA_DIR` | `/var/syncwave/data` |
| `CACHE_DIR` | `/var/syncwave/cache` |
| `PUBLIC_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |

`PORT` is injected by Railway and picked up automatically — don't set it.

The `${{...}}` syntax is Railway's own variable reference, so the URL tracks your
domain if it ever changes. Getting `PUBLIC_URL` right matters: it's what the
Share button hands to your friends.

### 4. Give it a working IP — the step everyone skips

Add **one** of these, or nothing will play:

| Variable | Value |
| --- | --- |
| `WEBSHARE_API_KEY` | your API token — the list is fetched and refreshed hourly |
| `YTDLP_PROXY_LIST` | `http://user:pass@host:port,http://user:pass@host2:port` |

A [free Webshare key](https://www.webshare.io/?referral_code=iw9gooahl4ty)
(referral) gives 10 proxies and 1 GB/month — around 350–400 tracks. Syncwave
tries the direct connection first and only falls back to the pool when Railway's
IP is refused, so nothing is wasted.

You can also paste either value into `/admin` later, without redeploying.

### 5. Get a URL and claim it

1. **Settings → Networking → Generate Domain**.
2. Open that domain **immediately** and set an admin password at `/setup`.

> Until you do, the instance is unclaimed and public — whoever loads `/setup`
> first owns it. This matters far more on Railway than on a home box.

### 6. Optional but recommended

- **Settings → Deploy → Health Check Path**: `/api/health` — cheap, and never
  touches yt-dlp or the network.
- **Settings → Deploy → Restart Policy**: `On Failure`.

### Checking it worked

Queue a track. If it plays, you're done. If it doesn't, open the deploy logs and
look for the resolver line:

```
[resolver] <id>: direct refused — trying 1.2.3.4:6754
[resolver] <id>: served via 1.2.3.4:6754
```

That is the fallback doing its job. If instead you see every proxy refused, the
pool is exhausted or the key is wrong — [see the troubleshooting section](#if-tracks-wont-play).

---

## Keeping it up to date

### By hand

```bash
cd /opt/syncwave           # wherever you installed it
sudo git pull
sudo docker compose up -d --build
curl -fsS http://127.0.0.1:3000/api/health && echo OK
```

Your rooms, settings, admin password and cached audio live in `./data` and
`./cache`. Nothing in an update touches either, and `.env` is left alone.

### On a timer

`scripts/self-update.sh` follows **releases**, not `main` — `main` is where work
lands, a tag is where it has been decided the work is finished, and an
unattended box should follow the second one. When there's a newer tag it
records the current commit, checks out the tag, rebuilds, and polls
`/api/health`; **if the app doesn't come back it puts the old commit back and
rebuilds that**, because a box that half-updated at 4am is worse than one that
didn't update at all.

See what an update would do, without doing it:

```bash
sudo ./scripts/self-update.sh --check
```

Run it now:

```bash
sudo ./scripts/self-update.sh
```

Install the daily timer (04:00 local, spread over an hour, catches up after a
reboot):

```bash
sudo cp scripts/systemd/syncwave-update.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now syncwave-update.timer
```

Check on it:

```bash
systemctl list-timers syncwave-update.timer
journalctl -u syncwave-update -n 50
```

The unit files assume `/opt/apps/syncwave`; edit `WorkingDirectory` and
`ExecStart` if you installed elsewhere. To stop auto-updating:
`sudo systemctl disable --now syncwave-update.timer`.

> **Should you turn this on?** If the instance is a permanent room for other
> people, yes — security fixes reach you without you thinking about it. If
> you've modified the checkout, no: the script does a hard checkout of the tag
> and your changes will be overwritten. Keep changes in `.env` and
> `docker-compose.override.yml`, which are never touched.

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
the top. A residential connection is still the best answer. Failing that, use a
proxy pool.

<a id="ytdlp_proxy"></a>

The block turns out not to be uniform. Measured on a fresh cloud instance: every
direct attempt was refused, while **4 of 10** proxies from the same commodity
provider fetched the same track fine. So Syncwave tries the direct connection
first and only falls back to the pool when the IP is refused — then remembers
which proxies worked, so the next track starts with one that just succeeded.

Point it at a provider and the list is fetched and refreshed hourly:

```
WEBSHARE_API_KEY=your-api-key
```

Or supply addresses yourself, from any provider:

```
YTDLP_PROXY_LIST=http://user:pass@host1:port,http://user:pass@host2:port
```

Or keep a single fixed proxy, which is always tried first:

```
YTDLP_PROXY=http://user:pass@residential-proxy.example:8000
```

> **Watch the bandwidth.** Measured end to end, a proxied track costs about
> **2.7 MB** — the file itself is ~1.6 MB and the rest is metadata requests and
> protocol overhead. So a 1 GB/month free plan is roughly **350–400 tracks**:
> fine for a few friends, nowhere near enough for a public instance. Syncwave caches each track for 72h, so repeat
> plays cost nothing, and the direct-first order means a home install never
> touches the pool at all.

---

## Configuration reference

Everything is optional. Copy `.env.example` to `.env` to change any of it.

| Variable | What it does |
| --- | --- |
| `PUBLIC_URL` | Base URL for share links. Unset = reflect the request origin (right for a LAN). |
| `PORT` | Port to listen on (default `3000`). |
| `DATA_DIR` | Rooms, settings, admin password, cookies (default `./data`). |
| `CACHE_DIR` | Downloaded audio (default `./cache`). |
| `CACHE_MAX_MB` | Disk cap for cached audio (default `4096`). Least recently played evicted first; `0` disables the cap. |
| `FFMPEG_PATH` | Path to a specific ffmpeg binary. Auto-detected otherwise. |
| `YTDLP_COOKIES_FILE` | Path to a `cookies.txt`. Takes precedence over an upload and disables the upload button. |
| `WEBSHARE_API_KEY` | Fetches a proxy pool from Webshare and refreshes it hourly. |
| `YTDLP_PROXY_LIST` | Comma-separated proxy URLs, any provider. Used instead of the API key. |
| `YTDLP_PROXY` | A single proxy, always tried first. Works alone, or alongside a pool. |

The **AI DJ** (provider, model, API key, persona) is configured at runtime in
the **`/admin`** console — no restart, no rebuild. Providers: a local **Ollama**
(no key), **Google Gemini** (free key from
[aistudio.google.com/apikey](https://aistudio.google.com/apikey)), **OpenAI** or
**Anthropic**. Leave it off and nothing else changes.
