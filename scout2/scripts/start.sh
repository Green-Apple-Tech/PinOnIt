#!/usr/bin/env bash
# Manual start: continuous Places collection in the background. No launchd KeepAlive.
# Stop with: ./scripts/stop.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NIGHTLY="$ROOT/scripts/run-nightly.sh"
LIVELOG="$ROOT/logs/nightly-live.log"
PIDFILE="$ROOT/logs/nightly.pid"
mkdir -p "$ROOT/logs"

if [[ -f "$PIDFILE" ]]; then
  pid="$(tr -d '[:space:]' < "$PIDFILE" || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "Scout2 already running (PID $pid). Stop first: $ROOT/scripts/stop.sh"
    exit 0
  fi
fi
if pgrep -f 'scout2/scripts/run-nightly.sh' >/dev/null 2>&1; then
  echo "Scout2 already running. Stop first: $ROOT/scripts/stop.sh"
  exit 0
fi

# Manual control — do not let KeepAlive take over.
if launchctl print "gui/$(id -u)/com.pinonit.scout2.nightly" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/com.pinonit.scout2.nightly" 2>/dev/null || true
fi

nohup "$NIGHTLY" >> "$LIVELOG" 2>&1 &
echo $! > "$PIDFILE"
sleep 2
echo "Scout2 started (PID $(tr -d '[:space:]' < "$PIDFILE")). Log: $LIVELOG"
echo "Stop with: $ROOT/scripts/stop.sh"
