#!/bin/bash
# Install and run the full Atoms Demo pipeline on Ubuntu Lighthouse.
# Usage (on the server):
#   curl -fsSL https://raw.githubusercontent.com/wenjuanlu516/atoms-demo/main/deploy/lighthouse.sh | bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/wenjuanlu516/atoms-demo.git}"
APP_DIR="${APP_DIR:-$HOME/atoms-demo}"
BRANCH="${BRANCH:-main}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

echo "==> Swap (2G) so npm/docker can finish on 2GB RAM"
if ! $SUDO swapon --show | grep -q .; then
  $SUDO fallocate -l 2G /swapfile || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile
  $SUDO swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

echo "==> Packages"
$SUDO apt-get update -y
$SUDO apt-get install -y ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Docker"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
$SUDO usermod -aG docker "${USER:-ubuntu}" || true

echo "==> Clone $REPO_URL"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi
cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
fi
# Production + persist under the compose volume. Keep LLM_MOCK unless the
# operator already set a key. Do not overwrite an existing secret.
python3 - <<'PY'
from pathlib import Path
import secrets
path = Path(".env")
lines = []
for line in path.read_text().splitlines():
    if line.startswith("APP_ENV="):
        lines.append("APP_ENV=production")
    elif line.startswith("JWT_SECRET=change-me-in-production"):
        lines.append("JWT_SECRET=lighthouse-" + secrets.token_urlsafe(32))
    else:
        lines.append(line)
path.write_text("\n".join(lines) + "\n")
PY

echo "==> Firewall (host). Also open TCP 8000 in the Lighthouse console."
if command -v ufw >/dev/null 2>&1; then
  $SUDO ufw allow 22/tcp || true
  $SUDO ufw allow 8000/tcp || true
fi
$SUDO iptables -C INPUT -p tcp --dport 8000 -j ACCEPT 2>/dev/null || \
  $SUDO iptables -I INPUT -p tcp --dport 8000 -j ACCEPT || true

echo "==> docker compose up --build (first time can take 5–10 minutes)"
$SUDO docker compose pull || true
$SUDO docker compose up -d --build

echo
echo "Health:"
sleep 3
curl -fsS http://127.0.0.1:8000/api/health || echo "Service not up yet; check: sudo docker compose logs -f"
echo
echo "Public URL (after console firewall allows 8000): http://$(curl -fsS --max-time 3 ifconfig.me || echo YOUR_PUBLIC_IP):8000"
echo "Default is LLM_MOCK=true. For a real model, edit $APP_DIR/.env then: sudo docker compose up -d"
