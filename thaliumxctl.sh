#!/usr/bin/env bash
set -euo pipefail

# Convenience launcher (repo root) for the interactive docker manager.
exec "$(dirname "$0")/docker/scripts/thaliumxctl.sh" "$@"

