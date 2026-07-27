#!/usr/bin/env bash
#
# Syncwave launcher for macOS and Linux.
#
#   ./start.sh              start it, and print a public link to share
#   ./start.sh --local      stay on the local network, no public link
#   ./start.sh --rebuild    force a rebuild first
#
# The real work happens in scripts/launch.mjs. All this has to do is produce a
# Node new enough to run it — preferring an installed one, and otherwise
# fetching a private copy into .runtime/node.

set -euo pipefail
cd "$(dirname "$0")"

RUNTIME="$PWD/.runtime/node"
CHANNEL="https://nodejs.org/dist/latest-v22.x"

# True when `node` on the current PATH is version 20 or newer. Probing by name
# lets the caller choose which Node that is by ordering PATH.
node_ok() {
  local v
  v="$(node -v 2>/dev/null)" || return 1
  v="${v#v}"
  v="${v%%.*}"
  case "$v" in '' | *[!0-9]*) return 1 ;; esac
  [ "$v" -ge 20 ]
}

fetch() { # url -> stdout
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$1"
  else
    return 1
  fi
}

fetch_to() { # url dest
  if command -v curl >/dev/null 2>&1; then
    curl -fL --progress-bar "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -O "$2" "$1"
  else
    return 1
  fi
}

verify() { # file expected-sha256
  local got
  if command -v shasum >/dev/null 2>&1; then
    got="$(shasum -a 256 "$1")"
  elif command -v sha256sum >/dev/null 2>&1; then
    got="$(sha256sum "$1")"
  else
    echo "  ! No checksum tool found, so the download can't be verified." >&2
    return 0
  fi
  [ "${got%% *}" = "$2" ] || {
    echo "  ! Checksum mismatch — the download was corrupted or tampered with." >&2
    return 1
  }
}

unpack_node() { # os arch tmpdir
  local os="$1" arch="$2" tmp="$3"
  local manifest line sum file inner

  echo "  Looking up the current Node LTS..."
  manifest="$(fetch "$CHANNEL/SHASUMS256.txt")" || return 1

  # The channel URL always points at the newest v22, so the exact filename and
  # its checksum are read out of the manifest rather than pinned in this file.
  # -m1 rather than `| head -1`: head exiting first would SIGPIPE grep, and
  # pipefail would then report a failure for a lookup that actually succeeded.
  line="$(printf '%s\n' "$manifest" | grep -E -m1 "  node-v[0-9.]+-$os-$arch\.tar\.gz\$")" || return 1
  sum="${line%% *}"
  file="${line##* }"

  echo "  Downloading $file..."
  fetch_to "$CHANNEL/$file" "$tmp/$file" || return 1
  verify "$tmp/$file" "$sum" || return 1

  echo "  Unpacking..."
  mkdir -p "$tmp/x"
  tar -xzf "$tmp/$file" -C "$tmp/x" || return 1

  # The tarball holds a single node-vX.Y.Z-os-arch folder; move it into place
  # under a stable name so this script doesn't have to guess the version.
  inner="$(find "$tmp/x" -mindepth 1 -maxdepth 1 -type d)"
  inner="${inner%%$'\n'*}"
  [ -n "$inner" ] || return 1

  mkdir -p "$(dirname "$RUNTIME")"
  rm -rf "$RUNTIME"
  mv "$inner" "$RUNTIME"
  echo "  Node is ready in .runtime/node"
}

# Unpacks an official Node build into .runtime/node. Nothing is installed
# system-wide; deleting .runtime undoes all of it.
bootstrap() {
  local os arch tmp rc=0

  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=x64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) return 1 ;;
  esac
  command -v tar >/dev/null 2>&1 || return 1

  cat <<'EOF'

  Syncwave needs Node.js and couldn't find it, so it will download a private
  copy (about 40 MB) into the .runtime folder next to this file.

  Nothing is installed system-wide and no settings are changed.
  Deleting .runtime undoes it completely.

EOF

  tmp="$(mktemp -d)" || return 1
  unpack_node "$os" "$arch" "$tmp" || rc=1
  rm -rf "$tmp"
  return "$rc"
}

if ! node_ok; then
  # Nothing usable is installed. Put our own copy first on PATH, which also makes
  # npm resolve to the matching one.
  PATH="$RUNTIME/bin:$PATH"
  export PATH

  if ! node_ok; then
    bootstrap || true

    # Checking the result rather than bootstrap's exit code also catches builds
    # that unpack fine but can't run here, such as glibc binaries on Alpine.
    if ! node_ok; then
      cat <<'EOF'

  Syncwave could not set up Node.js automatically.

  Install it yourself and run ./start.sh again:

    macOS:          brew install node
    Debian/Ubuntu:  sudo apt install nodejs npm
    Alpine:         apk add nodejs npm
    Other:          https://nodejs.org  (LTS)

EOF
      exit 1
    fi
  fi
fi

exec node scripts/launch.mjs "$@"
