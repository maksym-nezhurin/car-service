#!/usr/bin/env bash
# Hourly AUTO.RIA catalog sync — run by launchd (see com.autivo.autoria-sync.plist).
# Safe to re-run: the script self-limits to the hourly/monthly AUTO.RIA quota
# and SYNC_RESUME=1 (default) skips models already synced.
set -uo pipefail

# launchd jobs start with a minimal PATH and no shell profile loaded, so make
# common Node/pnpm install locations available before falling back to `command -v`.
export PATH="$HOME/.local/share/pnpm:$HOME/Library/pnpm:/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
# Pick up PATH changes from the user's own shell profile too, if any.
for f in "$HOME/.zprofile" "$HOME/.zshrc" "$HOME/.bash_profile"; do
  [ -f "$f" ] && \. "$f" >/dev/null 2>&1
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$SCRIPT_DIR"
LOG_FILE="$SCRIPT_DIR/logs/autoria-sync.log"
mkdir -p "$SCRIPT_DIR/logs"

echo "===== $(date -u +'%Y-%m-%dT%H:%M:%SZ') run start =====" >> "$LOG_FILE"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not found on PATH (checked common install dirs + shell profiles)." >> "$LOG_FILE"
  exit 1
fi

SYNC_PLAN=pl \
SYNC_PHASE=structure \
SYNC_REQUEST_BUDGET=969 \
SYNC_DELAY_MS=800 \
pnpm run catalog:sync:autoria >> "$LOG_FILE" 2>&1

echo "===== $(date -u +'%Y-%m-%dT%H:%M:%SZ') run end (exit $?) =====" >> "$LOG_FILE"
