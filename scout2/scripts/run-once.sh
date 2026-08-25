#!/usr/bin/env bash
# Manual Places run — next city only (or pass a number). No overnight loop. No ScaleSERP.
#   ./scripts/run-once.sh        # one city
#   ./scripts/run-once.sh 2      # two cities

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source .venv/bin/activate
export PYTHONPATH="$ROOT"
export SCOUT2_SEARCH=free
unset SCALESERP_KEY SCALESERP_API_KEY 2>/dev/null || true

CITIES="${1:-1}"
echo "Scout2 manual Places — ${CITIES} city(ies), ScaleSERP off"
python -m scout2.cli places-status
python -m scout2.cli places-once --cities "$CITIES"
python -m scout2.cli places-status
