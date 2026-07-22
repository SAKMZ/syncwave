#!/usr/bin/env bash
#
# Syncwave one-command installer for a fresh Ubuntu/Debian VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh | sudo bash
#
# With a domain (gets automatic HTTPS via Caddy, which enables the installable
# PWA and is what you want for anything shared with friends):
#
#   curl -fsSL .../install.sh | sudo DOMAIN=music.example.com EMAIL=you@example.com bash
#
# Re-running the script updates an existing install in place.
#
# Environment overrides:
#   DOMAIN    domain pointed at this server; enables Caddy + HTTPS
#   EMAIL     contact address for Let's Encrypt (recommended with DOMAIN)
#   REPO      git remote to install from   (default: SAKMZ/syncwave)
#   BRANCH    branch to install            (default: main)
#   DIR       install directory            (default: /opt/syncwave)

set -euo pipefail

REPO="${REPO:-https://github.com/SAKMZ/syncwave.git}"
BRANCH="${BRANCH:-main}"
DIR="${DIR:-/opt/syncwave}"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"

log()  { printf '\n\033[1;36m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m warn:\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (prefix the command with sudo)."

# ---------------------------------------------------------------- base packages
log "Installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends ca-certificates curl git >/dev/null

# ----------------------------------------------------------------------- docker
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh >/dev/null
else
  log "Docker already installed — skipping"
fi

docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is missing."
systemctl enable --now docker >/dev/null 2>&1 || true

# ------------------------------------------------------------------ source code
if [ -d "$DIR/.git" ]; then
  log "Updating existing install at $DIR"
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" reset --hard "origin/$BRANCH"
else
  log "Cloning Syncwave into $DIR"
  rm -rf "$DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

# ------------------------------------------------------------------------ .env
if [ -n "$DOMAIN" ]; then
  PUBLIC_URL="https://$DOMAIN"
else
  IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  PUBLIC_URL="http://${IP}:3000"
fi

if [ -f .env ]; then
  log "Keeping existing .env (PUBLIC_URL left as-is)"
else
  log "Writing .env  (PUBLIC_URL=$PUBLIC_URL)"
  cp .env.example .env
  sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=$PUBLIC_URL|" .env
fi

# ------------------------------------------------------------- caddy (optional)
if [ -n "$DOMAIN" ]; then
  if ! command -v caddy >/dev/null 2>&1; then
    log "Installing Caddy (automatic HTTPS)"
    apt-get install -y -qq --no-install-recommends debian-keyring debian-archive-keyring apt-transport-https >/dev/null
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
      | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
      > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy >/dev/null
  fi

  log "Configuring Caddy for $DOMAIN"
  {
    [ -n "$EMAIL" ] && printf '{\n\temail %s\n}\n\n' "$EMAIL"
    printf '%s {\n\treverse_proxy 127.0.0.1:3000\n}\n' "$DOMAIN"
  } > /etc/caddy/Caddyfile
  systemctl enable caddy >/dev/null 2>&1 || true
  systemctl restart caddy
fi

# --------------------------------------------------------------------- firewall
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  log "Opening firewall ports"
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  [ -z "$DOMAIN" ] && { ufw allow 3000/tcp >/dev/null 2>&1 || true; }
fi

# ------------------------------------------------------------------------ build
log "Building and starting Syncwave (first build takes a few minutes)"
docker compose up -d --build

# ----------------------------------------------------------------------- verify
log "Waiting for the app to come up"
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    READY=1; break
  fi
  sleep 3
done

URL="$(grep -E '^PUBLIC_URL=' .env | cut -d= -f2-)"

if [ "${READY:-0}" = "1" ]; then
  log "Syncwave is up"
else
  warn "Health check did not pass yet — it may still be building."
  warn "Check with:  docker compose -f $DIR/docker-compose.yml logs -f"
fi

cat <<EOF

  Syncwave  ->  $URL

  Manage it with:
    cd $DIR
    docker compose logs -f          # watch logs
    docker compose up -d --build    # redeploy after a git pull
    docker compose down             # stop

EOF

if [ -z "$DOMAIN" ]; then
  cat <<'EOF'
  Note: without a domain you are on plain HTTP, so browsers will not offer
  "Install app" (PWA install requires HTTPS). Point a domain at this server and
  re-run this script with DOMAIN=your.domain to get a free certificate.

EOF
fi
