#!/bin/bash
# One-time setup: print Bolt deploy reminder after every git push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x .githooks/post-push
git config core.hooksPath .githooks
echo "Done. core.hooksPath = .githooks"
echo "Next git push will remind you: Bolt Pull main → Publish"
