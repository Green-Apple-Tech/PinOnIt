#!/usr/bin/env bash
# Continuous Places: knock out every US city, one city at a time, then classify/extract.
# Google Places only — ScaleSERP is never used.
# Skips cities already finished. Keeps the Mac awake while this window is open.
# Ctrl+C to stop.
#
# Defaults cap Google Places at 80 searches/day (~2–3 cities). Raise or set 0 for unlimited:
#   SCOUT2_DAILY_QUERY_CAP=0 ./scripts/run-nightly.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v caffeinate >/dev/null 2>&1 && [[ -z "${SCOUT2_CAFFEINATED:-}" ]]; then
  export SCOUT2_CAFFEINATED=1
  exec caffeinate -dims "$0" "$@"
fi

# shellcheck disable=SC1091
source .venv/bin/activate
export PYTHONPATH="$ROOT"
export SCOUT2_SEARCH=free
unset SCALESERP_KEY SCALESERP_API_KEY

CITIES="${SCOUT2_CITIES_PER_CYCLE:-1}"
SLEEP="${SCOUT2_CYCLE_SLEEP_SEC:-600}"
CAP="${SCOUT2_DAILY_QUERY_CAP:-80}"
export SCOUT2_DAILY_QUERY_CAP="$CAP"

seconds_until_tomorrow() {
  python3 - <<'PY'
from datetime import datetime, timedelta
now = datetime.now()
nxt = (now + timedelta(days=1)).replace(hour=0, minute=2, second=0, microsecond=0)
print(max(60, int((nxt - now).total_seconds())))
PY
}

echo "Scout2 continuous Places — 1 city at a time, all 50 states"
echo "ScaleSERP: off  (Google Places + your own site checks only)"
echo "Cities/cycle=${CITIES}  sleep=${SLEEP}s  daily cap=${CAP} (0=unlimited)"
echo "Laptop must stay open. Ctrl+C to stop."
python -m scout2.cli places-status
echo "Ctrl+C to stop."
echo

while true; do
  echo "===== $(date) cycle start ====="
  python -m scout2.cli discover --source places --cities "$CITIES"
  python -m scout2.cli fingerprint --limit 400
  python -m scout2.cli classify --limit 150
  python -m scout2.cli extract --limit 150
  python -m scout2.cli verify --limit 300
  python -m scout2.cli score --limit 500
  python -m scout2.cli sheets-sync || true

  STATUS="$(python -m scout2.cli places-status --json)"
  echo "$STATUS"
  LEFT="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['queries_left'])" "$STATUS")"
  DAILY="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d['daily_left'] if d['daily_left'] is not None else 'inf')" "$STATUS")"
  NEXT="$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('next_city') or '(none)')" "$STATUS")"
  CITIES_LEFT="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['cities_left'])" "$STATUS")"

  if [[ "$LEFT" == "0" ]]; then
    echo "All cities finished. Draining leftover fingerprints, then idle 1h."
    echo "===== $(date) sleeping 3600s ====="
    sleep 3600
    continue
  fi
  if [[ "$DAILY" == "0" ]]; then
    WAIT="$(seconds_until_tomorrow)"
    echo "Daily Places cap reached. Next city: ${NEXT}. Sleeping ${WAIT}s until tomorrow."
    echo "===== $(date) cap wait ====="
    sleep "$WAIT"
    continue
  fi
  echo "Next: ${NEXT}  —  ${CITIES_LEFT} cities left, ${LEFT} searches left, daily remaining ${DAILY}"
  echo "===== $(date) cycle done — sleeping ${SLEEP}s ====="
  sleep "$SLEEP"
done
