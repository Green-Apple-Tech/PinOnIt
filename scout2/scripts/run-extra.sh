#!/usr/bin/env bash
# Manual extra directories (no ScaleSERP, no Google Places).
# Psychology Today, The Knot, WeddingWire, coaches, Houzz, Angi, BBB, Avvo,
# state license boards, and pages that already mention Calendly.
#   ./scripts/run-extra.sh
#   ./scripts/run-extra.sh "Miami FL"

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source .venv/bin/activate
export PYTHONPATH="$ROOT"
export SCOUT2_SEARCH=free
unset SCALESERP_KEY SCALESERP_API_KEY 2>/dev/null || true

LOC="${1:-USA}"
echo "Scout2 extra directories — location=${LOC}  ScaleSERP off"
python -m scout2.cli scrape-extra --location "$LOC"
python -m scout2.cli classify --limit 150
python -m scout2.cli extract --limit 150
python -m scout2.cli verify --limit 300
python -m scout2.cli score --limit 500
python -m scout2.cli sheets-sync || true
echo "Done extra directories."
