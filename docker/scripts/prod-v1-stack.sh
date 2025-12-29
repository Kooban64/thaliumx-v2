#!/usr/bin/env bash
set -euo pipefail

# ThaliumX prod-v1 stack runner (bulletproof-ish)
#
# Goals:
# - Always start the full set of compose files (so no services are accidentally skipped)
# - Support both "audit" (default) and "non-audit" profiles
# - Run required one-shot init jobs (Vault unseal + Keycloak post-import seeding)
# - Fail fast if required containers are missing/unhealthy

# MODE is historically audit|non-audit.
# Production intent is a single full stack; we keep old names as aliases.
MODE="${1:-production}" # production(full) | reduced(test) | audit(alias) | non-audit(alias)
shift || true

# Extra docker compose `up` flags can be passed after the mode, e.g.
#   docker/scripts/prod-v1-stack.sh audit --build
#   docker/scripts/prod-v1-stack.sh non-audit --build --pull always
UP_EXTRA_ARGS=("$@")

FILES=(
  base infrastructure databases messaging security gateway monitoring monitoring-extras
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
    echo "Usage: $0 [production|reduced]" >&2
    echo "  Backward-compatible aliases: audit(reduced), non-audit(production)" >&2
    exit 2
    ;;
esac

wait_container() {
  local name="$1"
  local timeout_seconds="${2:-300}"
  local i
  echo "Waiting for container: $name (timeout=${timeout_seconds}s)"
  for ((i=1;i<=timeout_seconds;i++)); do
    if ! docker inspect "$name" >/dev/null 2>&1; then
      sleep 1
      continue
    fi

    local state health
    state="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || true)"
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$name" 2>/dev/null || true)"

    if [[ "$state" == "running" ]] && ([[ "$health" == "healthy" ]] || [[ "$health" == "no-healthcheck" ]]); then
      echo "OK: $name is running ($health)"
      return 0
    fi

    sleep 1
  done

  echo "ERROR: container $name did not become ready" >&2
  docker ps -a --filter "name=$name" --format 'table {{.Names}}\t{{.Status}}' || true
  exit 1
}

echo "=== ThaliumX prod-v1 bring-up (mode=$MODE) ==="

echo "1) docker compose up -d (full file set)"
docker compose "${COMPOSE_ARGS[@]}" "${PROFILE_ARGS[@]}" up -d --remove-orphans "${UP_EXTRA_ARGS[@]}"

echo "2) wait for core services"
wait_container thaliumx-vault 300
wait_container thaliumx-keycloak 420
wait_container thaliumx-backend 420
wait_container thaliumx-frontend 180
wait_container thaliumx-apisix 180

if [[ "$MODE" == "production" || "$MODE" == "full" || "$MODE" == "non-audit" ]]; then
  echo "3) wait for production-only services (historically behind profile non-audit)"
  wait_container thaliumx-wazuh-manager 420 || true
  wait_container thaliumx-wazuh-indexer 420 || true
  wait_container thaliumx-wazuh-dashboard 420 || true
  wait_container thaliumx-ballerine-workflow 420 || true
  wait_container thaliumx-ballerine-backoffice 420 || true
  wait_container thaliumx-ballerine-postgres 420 || true
  wait_container thaliumx-blnkfinance 420 || true
fi

echo "4) run one-shot init jobs (idempotent)"
# Vault unseal: safe to run multiple times; exits 0 if already unsealed.
docker compose "${COMPOSE_ARGS[@]}" "${PROFILE_ARGS[@]}" run --rm vault-unseal

# Keycloak post-import patching: safe to rerun; it re-applies secrets/redirects.
docker compose "${COMPOSE_ARGS[@]}" "${PROFILE_ARGS[@]}" run --rm keycloak-post-import-seed

echo "5) final status"
docker ps --format 'table {{.Names}}\t{{.Status}}' | sed -n '1,120p'

echo "=== Done ==="
