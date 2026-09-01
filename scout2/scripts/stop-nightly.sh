#!/usr/bin/env bash
# Stop Scout2 overnight Places collection and related leftovers.
# Does not touch PinOnIt frontend/Vite unless it is a scout2 child.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/logs/nightly-stop.log"
PIDFILE="$ROOT/logs/nightly.pid"
WATCHDOG_PIDFILE="$ROOT/logs/nightly-watchdog.pid"
mkdir -p "$ROOT/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*" | tee -a "$LOG"; }

kill_pid() {
  local pid="$1"
  local why="$2"
  if [[ -z "${pid:-}" ]]; then
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  log "Stopping PID $pid ($why)"
  kill "$pid" 2>/dev/null || true
  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    log "PID $pid still alive; SIGKILL"
    kill -9 "$pid" 2>/dev/null || true
  fi
}

log "Scout2 overnight stop — 9:00 AM ET cutoff"

if [[ -f "$WATCHDOG_PIDFILE" ]]; then
  WPID="$(tr -d '[:space:]' < "$WATCHDOG_PIDFILE" || true)"
  # Don't kill ourselves if we are the watchdog
  if [[ -n "${WPID:-}" && "${WPID}" != "$$" ]]; then
    kill_pid "$WPID" "watchdog pidfile"
  fi
fi

if [[ -f "$PIDFILE" ]]; then
  NPID="$(tr -d '[:space:]' < "$PIDFILE" || true)"
  kill_pid "$NPID" "nightly pidfile"
  # caffeinate children
  if [[ -n "${NPID:-}" ]]; then
    pkill -P "$NPID" 2>/dev/null || true
  fi
fi

# Pattern match leftover overnight collection only (not weekday export-batch)
while read -r pid; do
  [[ -z "${pid:-}" || "$pid" == "$$" ]] && continue
  kill_pid "$pid" "pgrep match"
done < <(pgrep -f 'scout2/scripts/run-nightly.sh|python -m scout2.cli (discover|places-once|fingerprint|classify|extract|verify|score|sheets-sync)|caffeinate .*run-nightly' 2>/dev/null || true)

# Unload this one-shot stop agent if present
if launchctl list com.pinonit.scout2.nightly.stop >/dev/null 2>&1; then
  launchctl unload "$HOME/Library/LaunchAgents/com.pinonit.scout2.nightly.stop.plist" 2>/dev/null || true
  launchctl bootout "gui/$(id -u)/com.pinonit.scout2.nightly.stop" 2>/dev/null || true
fi

rm -f "$PIDFILE" "$WATCHDOG_PIDFILE"
log "Overnight collection stopped."
exit 0
