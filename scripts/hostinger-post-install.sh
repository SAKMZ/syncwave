#!/usr/bin/env bash
#
# Syncwave — Hostinger VPS post-install script.
#
# Paste this into hPanel → VPS → OS & Panel → Post-install scripts, then pick it
# when you create (or reinstall) the VPS. Hostinger runs it once as root after
# the OS is installed and logs to /post_install.log.
#
# OPTIONAL but recommended: point a domain's A record at the VPS IP, then set
# DOMAIN below. That gives you a free certificate and automatic HTTPS, which is
# what makes the "Install app" (PWA) prompt appear. Leave blank to run on
# plain HTTP at http://<vps-ip>:3000 and add a domain later.

DOMAIN=""
EMAIL=""

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# A freshly provisioned VM may still be holding apt locks from cloud-init.
for _ in $(seq 1 60); do
  fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break
  sleep 5
done

apt-get update -qq
apt-get install -y -qq --no-install-recommends ca-certificates curl >/dev/null

curl -fsSL https://raw.githubusercontent.com/SAKMZ/syncwave/main/scripts/install.sh \
  | DOMAIN="$DOMAIN" EMAIL="$EMAIL" bash

echo "Syncwave post-install finished at $(date -Is)"
