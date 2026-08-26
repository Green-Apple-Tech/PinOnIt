#!/usr/bin/env bash
# Continuous Places: knock out every US city, one city at a time, then classify/extract.
# Google Places only — ScaleSERP is never used.
# Skips cities already finished. Keeps the Mac awake while this window is open.
# Ctrl+C to stop.
#
# When a city finishes, the next city starts immediately (no long pause between cities).
# Defaults cap Google Places at 80 searches/day. Raise or set 0 for unlimited:
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

# Optional pause only after the Places+pipeline cycle (default: none — next city immediately)
SLEEP="${SCOUT2_CYCLE_SLEEP_SEC:-0}"
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

places_json() {
  python -m scout2.cli places-status --json
}

echo "Scout2 continuous Places — finish a city, immediately start the next"
echo "ScaleSERP: off  (Google Places + your own site checks only)"
echo "Between-city pause=${SLEEP}s  daily cap=${CAP} (0=unlimited)"
echo "Laptop must stay open. Ctrl+C to stop."
python -m scout2.cli places-status
echo "Ctrl+C to stop."
echo

while true; do
  echo "===== $(date) cycle start ====="

  # Places: one city at a time; as soon as one finishes, start the next until daily cap or done
  while true; do
    STATUS="$(places_json)"
    LEFT="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['queries_left'])" "$STATUS")"
    DAILY="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d['daily_left'] if d['daily_left'] is not None else 'inf')" "$STATUS")"
    NEXT="$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('next_city') or '(none)')" "$STATUS")"
    CITIES_LEFT="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['cities_left'])" "$STATUS")"

    if [[ "$LEFT" == "0" ]]; then
      echo "All cities finished."
      break
    fi
    if [[ "$DAILY" == "0" ]]; then
      echo "Daily Places cap reached before next city (${NEXT})."
      break
    fi

    echo ">>> $(date) Places city: ${NEXT}  (${CITIES_LEFT} cities left, daily remaining ${DAILY})"
    python -m scout2.cli discover --source places --cities 1

    AFTER="$(places_json)"
    AFTER_NEXT="$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('next_city') or '(none)')" "$AFTER")"
    echo ">>> City done. Next up: ${AFTER_NEXT} (starting immediately if quota remains)"
  done

  python -m scout2.cli fingerprint --limit 400
  python -m scout2.cli classify --limit 150
  python -m scout2.cli extract --limit 150
  python -m scout2.cli verify --limit 300
  python -m scout2.cli score --limit 500
  python -m scout2.cli sheets-sync || true

  STATUS="$(places_json)"
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
  if [[ "${SLEEP}" -gt 0 ]]; then
    echo "===== $(date) brief pause ${SLEEP}s ====="
    sleep "$SLEEP"
  fi
done
