#!/usr/bin/env bash
# Keep run-nightly.sh alive until Wednesday Sep 2, 2026 9:00 AM America/New_York, then stop.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/logs/nightly-watchdog.log"
PIDFILE="$ROOT/logs/nightly.pid"
WATCHDOG_PIDFILE="$ROOT/logs/nightly-watchdog.pid"
NIGHTLY="$ROOT/scripts/run-nightly.sh"
LIVELOG="$ROOT/logs/nightly-live.log"
mkdir -p "$ROOT/logs"

echo "$$" > "$WATCHDOG_PIDFILE"

STOP_AT="$(TZ=America/New_York python3 -c "from datetime import datetime; from zoneinfo import ZoneInfo; print(int(datetime(2026,9,2,9,0,tzinfo=ZoneInfo('America/New_York')).timestamp()))")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*" | tee -a "$LOG"; }

nightly_alive() {
  if [[ -f "$PIDFILE" ]]; then
    local pid
    pid="$(tr -d '[:space:]' < "$PIDFILE" || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  pgrep -f 'scout2/scripts/run-nightly.sh' >/dev/null 2>&1
}

start_nightly() {
  nohup "$NIGHTLY" >> "$LIVELOG" 2>&1 &
  echo $! > "$PIDFILE"
  sleep 2
  log "Started run-nightly.sh PID $(tr -d '[:space:]' < "$PIDFILE")"
}

log "Watchdog start. Stop at epoch $STOP_AT (2026-09-02 09:00 America/New_York)"

if ! nightly_alive; then
  start_nightly
else
  log "Nightly already running (PID $(tr -d '[:space:]' < "$PIDFILE" 2>/dev/null || echo '?'))"
fi

while true; do
  now="$(date +%s)"
  if [[ "$now" -ge "$STOP_AT" ]]; then
    log "Reached 9:00 AM ET stop time"
    exec "$ROOT/scripts/stop-nightly.sh"
  fi
  if ! nightly_alive; then
    log "Nightly died before cutoff; restarting"
    start_nightly
  fi
  sleep 30
done
