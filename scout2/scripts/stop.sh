#!/usr/bin/env bash
# Manual stop: unload launchd, kill Places collection, cancel the 9am auto-stop.
exec "$(cd "$(dirname "$0")" && pwd)/stop-nightly.sh"
