#!/usr/bin/env bash
set -euo pipefail

# Ensure the script works no matter where it is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

# ThaliumX prod-v1 sanity checker
#
# Checks:
# - expected services for a mode exist as containers (docker ps -a)
# - running services are healthy when healthchecks are defined

# MODE is historically audit|non-audit.
# Production intent is a single full stack; we keep old names as aliases.
MODE="${1:-production}" # production(full) | reduced(test) | audit(alias) | non-audit(alias)
shift || true

# By default, suppress noisy `docker compose config` warnings (obsolete `version:`, unset vars).
# Use `--verbose` to show them.
VERBOSE=0
for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=1 ;;
  esac
done

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

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

docker ps -a --format '{{.Names}}' | sort >"$tmpdir/containers_all.txt"

# Suppress common compose warnings unless VERBOSE=1.
# - Some compose files still include `version:` which emits a warning in compose v2.
# - Some compose files reference optional env vars (e.g. JAVA_OPTS, VAR) which emit warnings when unset.
export JAVA_OPTS="${JAVA_OPTS:-}"
export VAR="${VAR:-}"

warnings_file="$tmpdir/compose_warnings.txt"
if [[ "$VERBOSE" -eq 1 ]]; then
  docker compose "${COMPOSE_ARGS[@]}" "${PROFILE_ARGS[@]}" config --services | sort >"$tmpdir/services_expected.txt"
else
  docker compose "${COMPOSE_ARGS[@]}" "${PROFILE_ARGS[@]}" config --services 2>"$warnings_file" | sort >"$tmpdir/services_expected.txt"
fi

if [[ "$VERBOSE" -eq 1 ]]; then
  :
elif [[ -s "$warnings_file" ]]; then
  # Only surface unknown warnings.
  # Known noisy ones are filtered out.
  unknown="$tmpdir/compose_warnings_unknown.txt"
  # Use single quotes so backticks are treated as literals (no command substitution).
  grep -Ev 'attribute `version` is obsolete|variable is not set' "$warnings_file" >"$unknown" || true
  if [[ -s "$unknown" ]]; then
    echo "WARN: docker compose emitted warnings (use --verbose to see all):" >&2
    sed -n '1,50p' "$unknown" >&2
  fi
fi
awk '{print "thaliumx-"$0}' "$tmpdir/services_expected.txt" | sort >"$tmpdir/containers_expected.txt"

# One-shot jobs are allowed to be absent (when run with `docker compose run --rm`) or to be exited(0).
# They should NOT block the "stack is up" check.
ONESHOOT_CONTAINERS=(
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

# Summary (counts)
expected_total="$(wc -l <"$tmpdir/containers_expected.txt" | tr -d ' ')"
expected_persistent="$(wc -l <"$tmpdir/containers_expected_persistent.txt" | tr -d ' ')"
expected_oneshot="${#ONESHOOT_CONTAINERS[@]}"
running_now="$(docker ps --filter name=thaliumx- --format '{{.Names}}' | wc -l | tr -d ' ')"
echo "Summary: expected_total_services=$expected_total expected_long_running=$expected_persistent known_one_shot_jobs=$expected_oneshot running_now(thaliumx-*)=$running_now"

echo "Checking one-shot job containers (optional)…"
for c in "${ONESHOOT_CONTAINERS[@]}"; do
  if ! docker inspect "$c" >/dev/null 2>&1; then
    if [[ "$VERBOSE" -eq 1 ]]; then
      echo "WARN: one-shot container not found (this is OK if it is run with --rm): $c" >&2
    fi
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
  if [[ "$VERBOSE" -eq 1 ]]; then
    echo "WARN: $c is in state=$state exitCode=$exit_code" >&2
  fi
done

echo
echo "Legacy init containers (informational)…"
# These used to be part of the default `up` set. They are now behind profile `init-jobs` and are
# typically run with `docker compose --profile init-jobs run --rm ...`.
LEGACY_INIT_CONTAINERS=(
  thaliumx-vault-unseal
  thaliumx-keycloak-post-import-seed
)
for c in "${LEGACY_INIT_CONTAINERS[@]}"; do
  if docker inspect "$c" >/dev/null 2>&1; then
    state="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || true)"
    exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$c" 2>/dev/null || true)"
    echo "INFO: $c exists (state=$state exitCode=$exit_code) but is not part of the default prod-v1 service set anymore"
  fi
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

echo
echo "Vault sanity (best-effort)…"
if docker inspect thaliumx-vault >/dev/null 2>&1; then
  # NOTE: Our hardened Vault TLS certs may not include IP SANs; hostname validation can fail.
  # For this *sanity* check only, we skip verify so we can still report Sealed=true/false.
  # Runtime clients should still be configured with a valid Vault certificate/hostname pairing.
  status_out="$(docker exec thaliumx-vault vault status -tls-skip-verify -address=https://127.0.0.1:8200 2>/dev/null || true)"
  if echo "$status_out" | grep -Eq '^Sealed\s+false$'; then
    echo "OK: Vault is unsealed"
  elif echo "$status_out" | grep -Eq '^Sealed\s+true$'; then
    echo "WARN: Vault is SEALED (services that read secrets from Vault will fail)" >&2
  elif [[ -n "$status_out" ]]; then
    echo "WARN: Could not determine Vault sealed status (unexpected output)" >&2
    echo "$status_out" | sed -n '1,30p' >&2
  else
    echo "WARN: Vault status command produced no output" >&2
  fi
else
  echo "WARN: thaliumx-vault container not found" >&2
fi
