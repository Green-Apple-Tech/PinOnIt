#!/usr/bin/env bash
# Free directory + SERP loop. Does not call Google Places or ScaleSERP.
# Hours: SCOUT2_DIRECTORY_HOURS or first arg (default 10).
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
export PYTHONUNBUFFERED=1
export SCOUT2_SEARCH=free
unset SCALESERP_KEY SCALESERP_API_KEY

HOURS="${1:-${SCOUT2_DIRECTORY_HOURS:-10}}"
echo "Scout2 directory night — ${HOURS}h  ScaleSERP: off  waiver niches first"
echo "Laptop must stay open. Stop: kill \$(cat $ROOT/logs/directory-night.pid)"
exec python -u -m scout2.cli scrape-night --hours "$HOURS"
