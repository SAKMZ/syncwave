#!/usr/bin/env bash
#
# Syncwave launcher for macOS and Linux.
#
#   ./start.sh              start it, and print a public link to share
#   ./start.sh --local      stay on the local network, no public link
#   ./start.sh --rebuild    force a rebuild first
#
# The real work happens in scripts/launch.mjs — this only has to find Node.

set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  cat <<'EOF'

  Syncwave needs Node.js, which does not appear to be installed.

  macOS:          brew install node
  Debian/Ubuntu:  sudo apt install nodejs npm
  Other:          https://nodejs.org  (LTS)

  Then run ./start.sh again.

EOF
  exit 1
fi

exec node scripts/launch.mjs "$@"
