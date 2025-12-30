#!/usr/bin/env bash
set -euo pipefail

# Ensure the script works no matter where it is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

# ThaliumX prod-v1 docker-compose wrapper
#
# Purpose:
# - Provide ONE safe, consistent way to run arbitrary `docker compose` commands
#   against the full prod-v1 file set.
# - Avoid the common failure mode where someone runs `docker compose -f ...` with
#   only a subset of files and thinks “containers are missing”.
#
# Usage examples:
#   docker/scripts/prod-v1-compose.sh production ps
#   docker/scripts/prod-v1-compose.sh production logs -f --tail=200
#   docker/scripts/prod-v1-compose.sh reduced config --services

MODE="${1:-production}" # production(full) | reduced(test) | audit(alias) | non-audit(alias)
shift || true

FILES=(
  base infrastructure identity databases messaging security gateway monitoring monitoring-extras
  applications search trading fintech compliance wazuh
)

COMPOSE_ARGS=()
for f in "${FILES[@]}"; do
  COMPOSE_ARGS+=( -f "docker/compose/prod-v1/${f}.yml" )
done

PROFILE_ARGS=()
case "$MODE" in
  production|full|non-audit)
    PROFILE_ARGS=( --profile non-audit )
    ;;
  reduced|audit)
    ;;
  *)
    echo "Usage: $0 [production|reduced] <docker compose args...>" >&2
    echo "  Backward-compatible aliases: audit(reduced), non-audit(production)" >&2
    exit 2
    ;;
esac

docker compose "${COMPOSE_ARGS[@]}" "${PROFILE_ARGS[@]}" "$@"

