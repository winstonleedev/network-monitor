#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from the project root regardless of where the script is invoked.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

APP_NAME="network-monitor"
ENTRY_POINT="src/index.js"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but not found. Please install Node.js/npm." >&2
  exit 1
fi

# Restart app if it already exists so config changes apply.
if npx pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  npx pm2 delete "$APP_NAME"
fi

npx pm2 start "$ENTRY_POINT" \
  --name "$APP_NAME" \
  --time \
  --env production \
  --exp-backoff-restart-delay 2000

npx pm2 save

echo "Network monitor is running under PM2. View logs with: npx pm2 logs $APP_NAME"
