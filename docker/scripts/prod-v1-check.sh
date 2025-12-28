#!/usr/bin/env bash
set -euo pipefail

# ThaliumX prod-v1 sanity checker
#
# Checks:
# - expected services for a mode exist as containers (docker ps -a)
# - running services are healthy when healthchecks are defined

MODE="${1:-audit}" # audit | non-audit

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
  audit)
    ;;
  non-audit)
    PROFILE_ARGS=( --profile non-audit )
    ;;
  *)
    echo "Usage: $0 [audit|non-audit]" >&2
    exit 2
    ;;
esac

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

docker ps -a --format '{{.Names}}' | sort >"$tmpdir/containers_all.txt"

docker compose "${COMPOSE_ARGS[@]}" "${PROFILE_ARGS[@]}" config --services | sort >"$tmpdir/services_expected.txt"
awk '{print "thaliumx-"$0}' "$tmpdir/services_expected.txt" | sort >"$tmpdir/containers_expected.txt"

# One-shot jobs are allowed to be absent (when run with `docker compose run --rm`) or to be exited(0).
# They should NOT block the "stack is up" check.
ONESHOOT_CONTAINERS=(
  thaliumx-vault-unseal
  thaliumx-keycloak-post-import-seed
  thaliumx-apisix-init
  thaliumx-kafka-init
  thaliumx-blnkfinance-migrate
)

cp "$tmpdir/containers_expected.txt" "$tmpdir/containers_expected_persistent.txt"
for c in "${ONESHOOT_CONTAINERS[@]}"; do
  # remove exact line matches
  grep -vx "$c" "$tmpdir/containers_expected_persistent.txt" >"$tmpdir/_tmp" || true
  mv "$tmpdir/_tmp" "$tmpdir/containers_expected_persistent.txt"
done

comm -23 "$tmpdir/containers_expected_persistent.txt" "$tmpdir/containers_all.txt" >"$tmpdir/missing.txt" || true

if [[ -s "$tmpdir/missing.txt" ]]; then
  echo "FAIL: missing containers for mode=$MODE:" >&2
  cat "$tmpdir/missing.txt" >&2
  exit 1
fi

echo "OK: all expected long-running containers exist for mode=$MODE"

echo "Checking one-shot job containers (optional)…"
for c in "${ONESHOOT_CONTAINERS[@]}"; do
  if ! docker inspect "$c" >/dev/null 2>&1; then
    echo "WARN: one-shot container not found (this is OK if it is run with --rm): $c" >&2
    continue
  fi
  state="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || true)"
  exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$c" 2>/dev/null || true)"
  if [[ "$state" == "exited" ]] && [[ "$exit_code" == "0" ]]; then
    echo "OK: $c exited(0)"
    continue
  fi
  if [[ "$state" == "running" ]]; then
    echo "OK: $c is running (one-shot)"
    continue
  fi
  echo "WARN: $c is in state=$state exitCode=$exit_code" >&2
done

# Health check pass (only for running containers)
fail=0
while IFS= read -r name; do
  # Only check running containers; one-shots may not be present or may have exited.
  state="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)"
  if [[ "$state" != "running" ]]; then
    continue
  fi

  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$name" 2>/dev/null || echo unknown)"
  if [[ "$health" == "unhealthy" ]]; then
    echo "FAIL: $name is unhealthy" >&2
    fail=1
  fi
done <"$tmpdir/containers_expected_persistent.txt"

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "OK: all running containers are healthy (or have no healthcheck)"
