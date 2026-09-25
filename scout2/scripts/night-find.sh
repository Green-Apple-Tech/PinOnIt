#!/usr/bin/env bash
# Nightly lead find. Stops itself after 9 hours (10:00 PM → 7:00 AM).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Scheduled nights stay on free search. ScaleSerp runs only for a manual scrape-night.
export SCOUT2_SCALESERP_DISCOVERY=0
exec "$ROOT/scripts/run-directory-night.sh" 9
