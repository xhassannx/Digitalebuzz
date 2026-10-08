#!/usr/bin/env bash
set -euo pipefail

# Deploy one target instance on VPS.
# Required env vars:
# - APP_DIR: absolute deploy path for this customer/site
# - APP_NAME: PM2 process name for this customer/site
# - ARCHIVE_PATH: uploaded tar.gz path containing built app files
# Optional:
# - RUN_DB_PUSH: "true" to run npm run db:sync for this target

if [[ -z "${APP_DIR:-}" || -z "${APP_NAME:-}" || -z "${ARCHIVE_PATH:-}" ]]; then
  echo "Missing required env: APP_DIR, APP_NAME, ARCHIVE_PATH"
  exit 1
fi

load_user_node_path() {
  # GitHub Actions SSH is non-interactive and often skips login profiles,
  # so /usr/bin/node (v18) is used even when `node -v` shows v22 in CloudPanel terminal.
  for f in "${HOME}/.bashrc" "${HOME}/.profile" "${HOME}/.bash_profile"; do
    if [[ -s "$f" ]]; then
      # shellcheck disable=SC1090
      source "$f" 2>/dev/null || true
    fi
  done

  if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "${HOME}/.nvm/nvm.sh"
    nvm use default 2>/dev/null || nvm use node 2>/dev/null || nvm use --lts 2>/dev/null || true
  fi

  if [[ -d "${HOME}/.nvm/versions/node" ]]; then
    local newest
    newest="$(ls -1d "${HOME}/.nvm/versions/node"/v* 2>/dev/null | sort -V | tail -n1 || true)"
    if [[ -n "$newest" && -x "${newest}/bin/node" ]]; then
      export PATH="${newest}/bin:${PATH}"
    fi
  fi
}

ensure_node_20() {
  local required_major=20
  local current_major

  load_user_node_path

  current_major="$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1 || echo 0)"
  if [[ "${current_major:-0}" -ge "$required_major" ]]; then
    echo "Using Node $(node -v) at $(command -v node)"
    return 0
  fi

  echo "ERROR: Node.js ${required_major}+ required (found: $(node -v 2>/dev/null || echo 'not installed') at $(command -v node || echo 'unknown'))."
  echo "Interactive SSH may use nvm; CI deploy needs the same Node on PATH. Check: which node && node -v"
  exit 1
}

ensure_node_20

ensure_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    echo "Using PM2 at $(command -v pm2)"
    return 0
  fi
  local node_bin
  node_bin="$(command -v node 2>/dev/null || true)"
  if [[ -n "$node_bin" ]]; then
    export PATH="$(dirname "$node_bin"):${PATH}"
  fi
  if command -v pm2 >/dev/null 2>&1; then
    echo "Using PM2 at $(command -v pm2)"
    return 0
  fi
  echo "ERROR: pm2 not found (install with: npm i -g pm2 under your nvm Node)."
  exit 1
}

echo "Deploying target: ${APP_NAME}"
echo "Target directory: ${APP_DIR}"

mkdir -p "${APP_DIR}"
mkdir -p "${APP_DIR}/logs"

# Keep existing runtime secrets/config.
if [[ -f "${APP_DIR}/.env" ]]; then
  cp "${APP_DIR}/.env" "${APP_DIR}/.env.backup"
fi

cd "${APP_DIR}"

# Clean old runtime files but keep .env/logs/uploads/backups
rm -rf dist client server shared db scripts package.json package-lock.json \
  ecosystem.config.cjs ecosystem.config.js drizzle.config.ts tsconfig.json \
  vite.config.ts tailwind.config.ts postcss.config.js components.json \
  .github README.md 2>/dev/null || true

tar -xzf "${ARCHIVE_PATH}" -C "${APP_DIR}"
rm -f "${ARCHIVE_PATH}"

# Restore env if archive contained an .env (shouldn't happen, but safe)
if [[ -f "${APP_DIR}/.env.backup" ]]; then
  mv -f "${APP_DIR}/.env.backup" "${APP_DIR}/.env"
fi

if [[ ! -f package.json ]]; then
  echo "package.json missing after extract"
  exit 1
fi

# Full install (includes vite/esbuild/drizzle-kit). GitHub build is type-check only for CI;
# each VPS rebuilds with its own .env so VITE_TEMPLATE_ID / VITE_BASE_URL match the site.
if ! npm ci; then
  npm install
fi

if [[ -f .env ]]; then
  echo "Rebuilding from server .env (VITE_TEMPLATE_ID, VITE_BASE_URL, …)"
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "Effective template: VITE_TEMPLATE_ID=${VITE_TEMPLATE_ID:-${TEMPLATE_ID:-1}}"
  npm run build
else
  echo "No .env found — using pre-built dist/ from GitHub artifact"
fi

if [[ "${RUN_DB_PUSH:-false}" == "true" ]]; then
  echo "Running db:sync for ${APP_NAME}"
  npm run db:sync
fi

npm prune --omit=dev

ensure_pm2

# Restart/start PM2 process with target-specific env.
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}" --update-env
else
  PORT_FROM_ENV="$(awk -F= '$1=="PORT"{print $2}' .env 2>/dev/null | tail -n1 | tr -d '"' | xargs || true)"
  if [[ -n "${PORT_FROM_ENV}" ]]; then
    PORT="${PORT_FROM_ENV}" pm2 start dist/index.js --name "${APP_NAME}"
  else
    pm2 start dist/index.js --name "${APP_NAME}"
  fi
fi

pm2 save
pm2 status "${APP_NAME}" || true
echo "Deployment complete: ${APP_NAME}"
