#!/usr/bin/env bash
set -euo pipefail

# Ensure the script works no matter where it is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

# thaliumxctl.sh - interactive Docker Compose environment manager
#
# Pure bash menu (no whiptail/dialog dependency).
# Works for both audit and non-audit profiles.

FILES=(
  base infrastructure identity databases messaging security gateway monitoring monitoring-extras
  applications search trading fintech compliance wazuh
)

COMPOSE_ARGS=()
for f in "${FILES[@]}"; do
  COMPOSE_ARGS+=( -f "docker/compose/prod-v1/${f}.yml" )
done

# NOTE ABOUT MODES
# Historically we had two modes:
# - "audit"     => reduced stack (excludes services under Compose profile `non-audit`)
# - "non-audit" => full stack (includes Wazuh + Ballerine + BLNK)
#
# For production operations, we want ONE full stack.
# We keep the old names as aliases for backward-compatibility.
mode="production" # production(full) | reduced(test) | audit(alias) | non-audit(alias)

profile_args() {
  case "$mode" in
    production|full|non-audit)
      echo "--profile non-audit"
      ;;
    reduced|audit)
      echo ""
      ;;
    *)
      echo ""
      ;;
  esac
}

compose() {
  # shellcheck disable=SC2046
  docker compose "${COMPOSE_ARGS[@]}" $(profile_args) "$@"
}

compose_with_extra_profile() {
  local extra_profile="$1"
  shift
  # shellcheck disable=SC2046
  docker compose "${COMPOSE_ARGS[@]}" $(profile_args) --profile "$extra_profile" "$@"
}

banner() {
  # Only attempt terminal clearing when stdout is an actual TTY.
  if [[ -t 1 ]] && [[ -n "${TERM:-}" ]]; then
    clear || true
  fi
  echo "ThaliumX Docker Control (thaliumxctl)"
  echo "==================================="
  echo "Mode: $mode"
  echo "  - production/full: start EVERYTHING (includes services in compose profile 'non-audit')"
  echo "  - reduced/audit:   reduced stack (testing/debug only)"
  echo
}

pause() {
  # When called in non-interactive mode, don't block.
  if [[ "${THALIUMX_NO_PAUSE:-}" == "1" ]] || [[ ! -t 0 ]]; then
    return 0
  fi
  echo
  read -r -p "Press Enter to continue..." _
}

set_mode() {
  banner
  echo "Select mode:"
  echo "  1) production (FULL stack; recommended)"
  echo "  2) reduced (testing only; excludes Wazuh + Ballerine + BLNK)"
  echo
  read -r -p "Choice [1-2]: " c
  case "$c" in
    1) mode="production";;
    2) mode="reduced";;
    *) echo "Invalid choice"; pause;;
  esac
}

origin_report() {
  # Best-effort: show which compose project/working-dir a container belongs to.
  # This helps detect when multiple compose structures are being mixed.
  echo "== container origin (compose labels; best-effort) =="
  local name
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    local project wdir service
    project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$name" 2>/dev/null || true)"
    wdir="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$name" 2>/dev/null || true)"
    service="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$name" 2>/dev/null || true)"
    printf '%-35s  project=%-12s  service=%-22s  workdir=%s\n' "$name" "${project:-?}" "${service:-?}" "${wdir:-?}"
  done < <(docker ps -a --filter name=thaliumx- --format '{{.Names}}' | sort)
}

status() {
  banner
  echo "== docker ps (running) =="
  docker ps --format 'table {{.Names}}\t{{.Status}}' | sed -n '1,120p'
  echo
  echo "== thaliumx-* running count =="
  docker ps --filter name=thaliumx- --format '{{.Names}}' | wc -l | awk '{print "running(thaliumx-*): " $1}'
  echo
  echo "== prod-v1 sanity check (expected long-running containers + health) =="
  docker/scripts/prod-v1-check.sh "$mode" || true
  echo
  origin_report || true
  pause
}

doctor() {
  banner
  echo "== prod-v1 doctor (verbose compose config + container existence + health) =="
  docker/scripts/prod-v1-check.sh "$mode" --verbose || true

  echo
  echo "== thaliumx-* containers not running (if any) =="
  docker ps -a --filter name=thaliumx- --format 'table {{.Names}}\t{{.Status}}' | awk 'NR==1 || $2!="Up"'

  echo
  echo "== restarting containers (if any) =="
  docker ps -a --filter name=thaliumx- --filter status=restarting --format 'table {{.Names}}\t{{.Status}}' || true
  pause
}

start_stack() {
  banner
  echo "Starting full stack in mode=$mode (recommended)"
  echo
  # Use the hardened bring-up script so:
  # - we always use the full prod-v1 file set
  # - required one-shot init jobs run (Vault unseal + Keycloak post-import patch)
  # - we wait for core readiness
  docker/scripts/prod-v1-stack.sh "$mode"
  pause
}

start_stack_fast() {
  banner
  echo "Starting stack in mode=$mode (FAST; compose up only; DOES NOT run init jobs)"
  echo
  compose up -d --remove-orphans
  pause
}

start_stack_build() {
  banner
  echo "Starting full stack in mode=$mode (rebuild enabled)"
  echo
  # Reuse the hardened bring-up script so one-shot init jobs run too.
  docker/scripts/prod-v1-stack.sh "$mode" --build
  pause
}

stop_stack() {
  banner
  echo "Stopping all services in mode=$mode (containers remain)"
  echo
  compose stop
  pause
}

down_stack() {
  banner
  echo "Bringing stack DOWN in mode=$mode (containers removed; volumes preserved)"
  echo
  compose down --remove-orphans
  pause
}

restart_core() {
  banner
  echo "Restarting core app path (frontend/backend/gateway/auth)."
  echo "NOTE: This does not restart databases." 
  echo
  # Service names are compose service keys (without thaliumx- prefix)
  compose restart apisix backend frontend opa || true
  pause
}

run_init_jobs() {
  banner
  echo "Running one-shot init jobs (idempotent):"
  echo " - vault-unseal"
  echo " - keycloak-post-import-seed (applies ThaliumX realm theme)"
  echo
  # These jobs are intentionally NOT part of the default `up` set.
  # They live behind the compose profile `init-jobs` to avoid showing up as “exited” containers.
  compose_with_extra_profile init-jobs run --rm vault-unseal
  compose_with_extra_profile init-jobs run --rm keycloak-post-import-seed
  pause
}

reseed_gateway_routes() {
  banner
  echo "Reseeding APISIX routes (idempotent)."
  echo
  echo "This will rerun the one-shot 'apisix-init' job which (re)creates routes + SSL objects in ETCD."
  echo "Auth provider is set to Keycloak."
  echo

  local provider="keycloak"

  local enable_oidc
  read -r -p "Enable APISIX OIDC enforcement? [true/false] (default: true): " enable_oidc
  enable_oidc="${enable_oidc:-true}"
  if [[ "$enable_oidc" != "true" && "$enable_oidc" != "false" ]]; then
    echo "Invalid value: $enable_oidc" >&2
    pause
    return
  fi

  echo
  echo "Running: THALIUMX_AUTH_PROVIDER=$provider APISIX_ENABLE_OIDC=$enable_oidc docker compose ... up -d apisix-init"
  echo

  # Force recreate ensures the init job reruns even if the container already exists in exited state.
  THALIUMX_AUTH_PROVIDER="$provider" APISIX_ENABLE_OIDC="$enable_oidc" \
    compose up -d --no-deps --force-recreate apisix-init

  echo
  echo "Done. APISIX reads config from ETCD dynamically; no APISIX restart should be required." 
  pause
}

tail_logs() {
  banner
  echo "Tail logs for a service (Ctrl+C to exit)."
  echo
  compose config --services | nl -w2 -s') '
  echo
  read -r -p "Enter service name: " svc
  if [[ -z "$svc" ]]; then
    pause
    return
  fi
  compose logs -f --tail=200 "$svc"
}

show_groups() {
  banner
  echo "Logical groups (informational):"
  cat <<'TXT'
CORE:
  apisix, frontend, backend, opa, vault, postgres, redis, kafka, mongodb, schema-registry

OBSERVABILITY:
  grafana, prometheus, alertmanager, loki, tempo, otel-collector, promtail, cadvisor, blackbox-exporter

TRADING/COMPLIANCE:
  dingir-*, liquibook, quantlib, compliance-*

PRODUCTION-ONLY SERVICES (historically behind compose profile 'non-audit'):
  wazuh-*, ballerine-*, blnkfinance*
TXT
  echo
  echo "Tip: use 'Tail logs' to inspect any service." 
  pause
}

usage() {
  cat <<'TXT'
Usage:
  ./thaliumxctl.sh                # interactive menu
  ./thaliumxctl.sh status         # show status + sanity check
  ./thaliumxctl.sh doctor         # verbose sanity + highlight non-running containers
  ./thaliumxctl.sh up             # start (no build)
  ./thaliumxctl.sh up-fast        # start via raw compose up (no init jobs)
  ./thaliumxctl.sh up-build       # start with build + run init jobs
  ./thaliumxctl.sh init-jobs      # run one-shot init jobs
  ./thaliumxctl.sh reseed-gateway # rerun apisix-init (switch /auth provider)
  ./thaliumxctl.sh stop           # stop containers (keep)
  ./thaliumxctl.sh down           # remove containers

Mode control (optional env):
  THALIUMX_MODE=production|reduced

Notes:
  - production/full starts EVERYTHING (includes compose profile 'non-audit')
  - reduced/audit is for testing/debug only
TXT
}

main_menu() {
  while true; do
    banner
    echo "1) Switch mode (production/reduced)"
    echo "2) Status / health check"
    echo "2b) Doctor (verbose health + missing containers)"
    echo "3) Start stack (no build; includes init jobs + readiness waits)"
    echo "3b) Start stack FAST (compose up only; no init jobs)"
    echo "4) Start stack (with build + run init jobs)"
    echo "5) Stop stack (containers remain)"
    echo "6) Down stack (remove containers)"
    echo "7) Restart core (frontend/backend/gateway/auth)"
    echo "8) Run init jobs (vault-unseal)"
    echo "8b) Reseed APISIX routes (switch /auth provider)"
    echo "9) Tail logs (pick service)"
    echo "10) Show logical groups (info)"
    echo "0) Exit"
    echo
    read -r -p "Select: " choice

    case "$choice" in
      1) set_mode;;
      2) status;;
      2b|2B) doctor;;
      3) start_stack;;
      3b|3B) start_stack_fast;;
      4) start_stack_build;;
      5) stop_stack;;
      6) down_stack;;
      7) restart_core;;
      8) run_init_jobs;;
      8b|8B) reseed_gateway_routes;;
      9) tail_logs;;
      10) show_groups;;
      0) exit 0;;
      *) echo "Invalid choice"; pause;;
    esac
  done
}

mode="${THALIUMX_MODE:-$mode}"

case "${1:-}" in
  "")
    main_menu
    ;;
  -h|--help|help)
    usage
    ;;
  status)
    status
    ;;
  doctor)
    doctor
    ;;
  up)
    start_stack
    ;;
  up-fast)
    start_stack_fast
    ;;
  up-build)
    start_stack_build
    ;;
  init-jobs)
    run_init_jobs
    ;;
  reseed-gateway)
    reseed_gateway_routes
    ;;
  stop)
    stop_stack
    ;;
  down)
    down_stack
    ;;
  *)
    echo "Unknown command: $1" >&2
    echo
    usage >&2
    exit 2
    ;;
esac
