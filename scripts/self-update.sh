#!/usr/bin/env bash
#
# Update a Docker install to the newest *release*, and undo it if the result
# doesn't answer.
#
# Deliberately tracks tags rather than `main`. `main` is where work lands; a
# tag is where it has been decided that the work is finished. An unattended box
# should follow the second one.
#
# Nothing happens when there is no new tag, so this is safe to run on a timer.
# When there is one:
#
#   1. remember the commit currently deployed
#   2. check out the new tag and rebuild
#   3. poll /api/health
#   4. if it never comes up, go back to the remembered commit, rebuild, and
#      exit non-zero — a box that half-updated at 4am is worse than one that
#      didn't update at all
#
# Rooms, settings and cached audio live in ./data and ./cache and are never
# touched by any of this.
#
# Usage:
#   sudo ./scripts/self-update.sh              # update if a newer tag exists
#   sudo ./scripts/self-update.sh --check      # say what would happen, do nothing
#   sudo ./scripts/self-update.sh --force      # rebuild even if already current
#
# Environment:
#   DIR          install directory        (default: the repo this script is in)
#   HEALTH_URL   health endpoint          (default: http://127.0.0.1:3000/api/health)
#   TIMEOUT      seconds to wait for health after a rebuild (default: 300)

set -euo pipefail

DIR="${DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
TIMEOUT="${TIMEOUT:-300}"

MODE="run"
case "${1:-}" in
  --check) MODE="check" ;;
  --force) MODE="force" ;;
  "") ;;
  *) echo "unknown argument: $1" >&2; exit 2 ;;
esac

log() { printf '%s  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
die() { log "error: $*"; exit 1; }

cd "$DIR" || die "no such directory: $DIR"
[ -d .git ] || die "$DIR is not a git checkout — this script updates git installs only"
# Only a real run needs docker. `--check` answers a question about git and
# should work anywhere, including on the machine you develop on.
[ "$MODE" = "check" ] || command -v docker >/dev/null 2>&1 || die "docker is not installed"

# Every git call goes through this.
#
# The install is usually owned by the user who cloned it while the updater runs
# as root, which trips git's dubious-ownership guard. Doing it per-invocation
# rather than with `git config --global --add safe.directory` keeps the
# exception scoped to this one directory instead of writing a permanent
# exemption into whatever config file happens to be in reach — and under
# systemd there is no HOME, so that config would not be read anyway. That last
# part is the trap: the same command works by hand under `sudo` and fails from
# a timer, which is a horrible thing to debug at 4am.
GIT=(git -c "safe.directory=$DIR")

# ------------------------------------------------------------------ what's new
"${GIT[@]}" fetch --tags --quiet origin || die "git fetch failed (see the error above)"

# Newest tag by version, not by date: a patch to an older line can be tagged
# after a newer minor, and creation order would then walk the box backwards.
LATEST="$("${GIT[@]}" tag -l 'v*' --sort=-v:refname | head -1)"
[ -n "$LATEST" ] || die "no release tags found"

CURRENT_COMMIT="$("${GIT[@]}" rev-parse HEAD)"
LATEST_COMMIT="$("${GIT[@]}" rev-parse "${LATEST}^{commit}")"
CURRENT_NAME="$("${GIT[@]}" describe --tags --always 2>/dev/null || echo "$CURRENT_COMMIT")"

if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ] && [ "$MODE" != "force" ]; then
  log "already on $LATEST — nothing to do"
  exit 0
fi

if [ "$MODE" = "check" ]; then
  log "update available: $CURRENT_NAME -> $LATEST"
  "${GIT[@]}" log --oneline "${CURRENT_COMMIT}..${LATEST_COMMIT}" | sed 's/^/    /'
  exit 0
fi

log "updating $CURRENT_NAME -> $LATEST"

# ------------------------------------------------------------------- the build
# Detached at the tag on purpose. A box that follows releases has no use for a
# branch, and this makes "what is deployed" a single unambiguous answer.
"${GIT[@]}" checkout --quiet --force "$LATEST" || die "could not check out $LATEST"

if ! docker compose up -d --build; then
  log "build failed — rolling back to $CURRENT_NAME"
  "${GIT[@]}" checkout --quiet --force "$CURRENT_COMMIT"
  docker compose up -d --build || log "rollback build also failed — the app may be down"
  exit 1
fi

# ------------------------------------------------------------------- is it up?
log "waiting up to ${TIMEOUT}s for $HEALTH_URL"
deadline=$(( $(date +%s) + TIMEOUT ))
until curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    log "health check never passed — rolling back to $CURRENT_NAME"
    docker compose logs --tail 40 || true
    "${GIT[@]}" checkout --quiet --force "$CURRENT_COMMIT"
    docker compose up -d --build || log "rollback build also failed — the app may be down"
    exit 1
  fi
  sleep 5
done

log "$LATEST is up"

# Old images add up fast on a small boot volume, and the one thing an
# unattended updater must not do is fill the disk. Only dangling layers go;
# named images and anything in use are left alone.
docker image prune -f >/dev/null 2>&1 || true
