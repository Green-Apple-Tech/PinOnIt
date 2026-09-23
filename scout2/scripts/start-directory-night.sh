#!/usr/bin/env bash
# Detached free directory + SERP scrape. Does not call Google Places.
# Stop with: kill "$(cat logs/directory-night.pid)"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$ROOT/scripts/run-directory-night.sh"
LIVELOG="$ROOT/logs/directory-night.log"
PIDFILE="$ROOT/logs/directory-night.pid"
HOURS="${1:-10}"
mkdir -p "$ROOT/logs"

if [[ -f "$PIDFILE" ]]; then
  pid="$(tr -d '[:space:]' < "$PIDFILE" || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "Directory night already running (PID $pid). Log: $LIVELOG"
    exit 0
  fi
fi

# Don't let KeepAlive Places collector steal the machine (Places billing is off).
if launchctl print "gui/$(id -u)/com.pinonit.scout2.nightly" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/com.pinonit.scout2.nightly" 2>/dev/null || true
fi

nohup "$RUNNER" "$HOURS" >> "$LIVELOG" 2>&1 &
echo $! > "$PIDFILE"
sleep 2
echo "Directory night started (PID $(tr -d '[:space:]' < "$PIDFILE")) for ${HOURS}h. Log: $LIVELOG"
echo "Stop with: kill \$(cat $PIDFILE)"
