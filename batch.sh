#!/usr/bin/env bash
# Daily Scout2 ramp export. Usage: ./batch.sh [niche]
# Weekday automation calls this; weekends should not invoke it (launchd calendar).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# Prefer PinOnIt/scout2 when script lives at PinOnIt root
if [[ -d "$ROOT/scout2" && -f "$ROOT/scout2/scout2/cli.py" ]]; then
  SCOUT="$ROOT/scout2"
elif [[ -f "$ROOT/scout2/cli.py" ]]; then
  SCOUT="$ROOT"
else
  echo "Cannot find scout2 package from $ROOT" >&2
  exit 1
fi

NICHE="${1:-landscaping}"
cd "$SCOUT"

if [[ -f .venv/bin/activate ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
else
  echo "Missing $SCOUT/.venv — run: python3 -m venv .venv && pip install -r requirements.txt" >&2
  exit 1
fi

mkdir -p logs
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] export-batch --niche $NICHE" | tee -a logs/batch.log

OUT="$(python -m scout2.cli export-batch --niche "$NICHE" 2>&1)"
echo "$OUT" | tee -a logs/batch.log
# Surface sheet URL for automation / alias users
echo "$OUT" | grep -E '^(Sheet:|Tab:|Before sending:)' || true
