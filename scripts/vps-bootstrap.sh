#!/usr/bin/env bash
# One-time VPS setup for a single deploy target (run on Hostinger VPS terminal).
# Usage:
#   bash scripts/vps-bootstrap.sh /home/USER/htdocs/domain.com/helicoptic-whatsapp 5002

set -euo pipefail

APP_DIR="${1:-}"
PORT="${2:-5002}"

if [[ -z "$APP_DIR" ]]; then
  echo "Usage: bash scripts/vps-bootstrap.sh <deploy_path> [port]"
  echo "Example: bash scripts/vps-bootstrap.sh /home/user/htdocs/wa.example.com/helicoptic-whatsapp 5002"
  exit 1
fi

echo "==> Creating deploy directory: ${APP_DIR}"
mkdir -p "${APP_DIR}/logs"

if [[ ! -f "${APP_DIR}/.env" ]]; then
  echo "==> Creating starter .env (edit values before first deploy)"
  cat > "${APP_DIR}/.env" <<EOF
NODE_ENV=production
PORT=${PORT}
BASE_URL=https://your-domain.com
VITE_BASE_URL=https://your-domain.com
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change-me-$(date +%s)")
EOF
  chmod 600 "${APP_DIR}/.env"
else
  echo "==> .env already exists — keeping it"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 20+ first."
  exit 1
fi

NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1)"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "Node.js 20+ required. Current: $(node -v)"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing PM2 globally"
  npm install -g pm2
fi

echo "==> Bootstrap complete for ${APP_DIR}"
echo "Next:"
echo "  1) Edit ${APP_DIR}/.env with real production values"
echo "  2) Add this target to GitHub variable DEPLOY_TARGETS_JSON"
echo "  3) Push to main — CI/CD will deploy automatically"
