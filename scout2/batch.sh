#!/usr/bin/env bash
# Convenience wrapper when run from scout2/ — delegates to PinOnIt/batch.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/batch.sh" "$@"
