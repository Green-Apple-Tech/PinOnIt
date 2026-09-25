#!/usr/bin/env bash
# Weekday and weekend: stage today's 20 leads onto the send-today sheet tab.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source .venv/bin/activate
export PYTHONPATH="$ROOT"
export PYTHONUNBUFFERED=1
echo "===== $(date) morning send ====="
exec python -m scout2.cli morning-send
