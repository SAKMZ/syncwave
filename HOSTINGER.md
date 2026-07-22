<div align="center">

# Deploy Syncwave on a Hostinger VPS

**Your own always-on listening server, in about five minutes.**

[![Get a VPS](https://img.shields.io/badge/Get%20a-Hostinger%20VPS-673DE6?style=for-the-badge&logo=hostinger&logoColor=white)](https://www.hostinger.com/in?REFERRALCODE=LUZAUTOMIP2T)

</div>

---

## Why a VPS?

Syncwave is a **stateful** app — a long-lived WebSocket server, live yt-dlp
processes, and a disk cache of the audio it has already fetched. A VPS gives you:

- **Root access**, so you can drop in a YouTube `cookies.txt` when yt-dlp gets
  bot-checked (the single most common playback problem on cloud hosts).
- **A real disk** — 50 GB+ of audio cache instead of a metered few GB.
- **Room to grow** — run Syncwave alongside anything else on the same box.
- **Flat pricing** — no per-GB disk or bandwidth surprises.

If you'd rather not touch a server at all, the
[one-click Render deploy](README.md#-one-click--render) is the easier path. This
guide is for people who want control.

## What you need

- A VPS running **Ubuntu 24.04** (1 vCPU / 4 GB RAM is comfortable).
- *Optional but strongly recommended:* a domain name. Without HTTPS, browsers
  will not offer the **Install app** (PWA) prompt — that's a browser rule, not a
  Syncwave limitation.

---

## Step 1 — Get the VPS

[**Hostinger VPS →**](https://www.hostinger.com/in?REFERRALCODE=LUZAUTOMIP2T)

Pick the **KVM 1** plan (1 vCPU, 4 GB RAM, 50 GB NVMe) — that is plenty for a
room or two with a healthy audio cache. Step up to KVM 2 if you plan to run
several busy rooms or host other things beside it.

When the setup wizard asks for an OS, choose **Ubuntu 24.04** (plain — not a
panel image like CyberPanel or CloudPanel, which will fight you over ports 80 and
443).

> Using a different provider? Everything below works unchanged on any Ubuntu or
> Debian VPS — DigitalOcean, Vultr, Hetzner, Linode, or a box under your desk.
> See [DEPLOY.md](DEPLOY.md).

## Step 2 — Point a domain at it *(optional, do this before Step 3)*

If you have a domain, add an **A record** pointing at your VPS's IP address
**now**, before installing. DNS takes a few minutes to propagate, and having it
ready means the installer can grab an HTTPS certificate on its first run.

```
Type    Name        Value
A       music       203.0.113.42      # your VPS IP
```

That gives you `music.example.com`.

## Step 3 — Install Syncwave

Two ways. Pick one.

### Option A — Zero SSH (the VPS installs itself)

Hostinger can run a script automatically the first time your VPS boots.

1. In **hPanel → VPS → OS & Panel → Post-install scripts**, click **Add script**.
2. Paste the contents of
   [`scripts/hostinger-post-install.sh`](scripts/hostinger-post-install.sh).
3. Before saving, fill in the two variables at the top if you have a domain:
   ```bash
   DOMAIN="music.example.com"
   EMAIL="you@example.com"
   ```
4. Select that script when you **create** the VPS (or when you reinstall the OS
   on an existing one).

When provisioning finishes, Syncwave is already running. Progress is logged to
`/post_install.log` on the server if you want to watch it.

### Option B — One SSH command

SSH in as root, then:

```bash
curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh | sudo bash
```

With a domain (recommended — this is what unlocks the installable PWA):

```bash
curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh \
  | sudo DOMAIN=music.example.com EMAIL=you@example.com bash
```

**What the installer actually does** — it's a readable ~150-line shell script,
and you're encouraged to skim it before piping anything to `sudo bash`:

1. Installs Docker (via the official `get.docker.com` script) if missing.
2. Clones Syncwave to `/opt/syncwave`.
3. Writes `.env` with the right `PUBLIC_URL` for your domain or IP.
4. If `DOMAIN` is set: installs **Caddy** and configures it as a reverse proxy,
   which fetches a free Let's Encrypt certificate automatically and renews it.
5. Opens the needed firewall ports if `ufw` is active.
6. Builds the container and waits for `/api/health` to come up.

It is **idempotent** — re-run the exact same command any time to update an
existing install in place. Your rooms and cache are preserved.

## Step 4 — Open it

- **With a domain:** `https://music.example.com`
- **Without:** `http://YOUR_VPS_IP:3000`

The first visit sends you to **`/setup`** to create an admin password. **Do this
immediately** — until you do, anyone who can reach the URL can claim the instance.

Then create a room, share the link, and you're done. On HTTPS you'll also see an
**Install this room** banner — installing it creates an app that launches
straight back into that specific room.

---

## Managing your server

```bash
cd /opt/syncwave

docker compose logs -f                     # watch logs
docker compose restart                     # restart
docker compose down                        # stop
git pull && docker compose up -d --build   # update to the latest Syncwave
```

Your data lives in two folders that survive every rebuild:

- `/opt/syncwave/data` — rooms, settings, cache index. **Permanent room links
  live here** — back this up if a room matters to you.
- `/opt/syncwave/cache` — downloaded audio, auto-evicted 72h after last play.

## Troubleshooting

**Tracks get skipped immediately / "Sign in to confirm you're not a bot"**

YouTube bot-checks datacenter IPs. Fix it with a cookies file — no SSH needed:

1. Install a "Get cookies.txt LOCALLY" browser extension, log in to YouTube, and
   export `cookies.txt` (Netscape format).
2. Go to **`/admin` → YouTube access → Upload cookies.txt**.

It takes effect on the very next track. **Use a throwaway Google account** — the
file is a live login session, and every track this server fetches is requested as
that account.

**No "Install app" button**

You're on plain HTTP. Point a domain at the VPS and re-run the installer with
`DOMAIN=` set (Step 3). Browsers only allow app installs over HTTPS.

**Certificate didn't issue**

Check the A record actually resolves to your VPS (`dig +short music.example.com`)
and that ports 80 and 443 are open. Then `systemctl restart caddy` and check
`journalctl -u caddy -n 50`.

**Something else**

`docker compose logs -f` is almost always the answer. If it looks like a bug,
[open an issue](https://github.com/SAKMZ/syncwave/issues).

---

<sub>The Hostinger links on this page are referral links — if you sign up through
them, they support Syncwave's development at no extra cost to you. Syncwave is
MIT-licensed and runs identically on any Ubuntu host; nothing here is
Hostinger-specific except Step 3's Option A.</sub>
