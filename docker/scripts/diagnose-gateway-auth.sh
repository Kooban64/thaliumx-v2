#!/usr/bin/env bash
set -euo pipefail

# ThaliumX Gateway/Auth Diagnostics
# =================================
# Purpose: Collect evidence about the current APISIX/ETCD/Keycloak routing + auth wiring.
# This script is read-only: it does not mutate routes, consumers, or etcd keys.
#
# Expected container names (from compose):
# - thaliumx-apisix
# - thaliumx-etcd
# - thaliumx-keycloak

APISIX_CONTAINER="${APISIX_CONTAINER:-thaliumx-apisix}"
ETCD_CONTAINER="${ETCD_CONTAINER:-thaliumx-etcd}"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-thaliumx-keycloak}"

echo "=== ThaliumX Gateway/Auth Diagnostics ==="
date -u
echo

section() {
  echo
  echo "--- $1 ---"
}

have_docker() {
  command -v docker >/dev/null 2>&1
}

require_docker() {
  if ! have_docker; then
    echo "ERROR: docker CLI not found in PATH" >&2
    exit 1
  fi
}

container_running() {
  local name="$1"
  docker ps --format '{{.Names}}' | grep -qx "$name"
}

exec_in() {
  local name="$1"; shift
  docker exec "$name" "$@"
}

exec_in_sh() {
  local name="$1"; shift
  docker exec "$name" sh -lc "$*"
}

curl_in() {
  local name="$1"; shift
  # Print both status + first lines of body.
  exec_in_sh "$name" "set -e; curl -sS -D /tmp/headers.txt -o /tmp/body.txt $* || true; head -n 20 /tmp/headers.txt; echo; head -n 40 /tmp/body.txt"
}

require_docker

section "Docker/Containers"
echo "APISIX_CONTAINER=$APISIX_CONTAINER"
echo "ETCD_CONTAINER=$ETCD_CONTAINER"
echo "KEYCLOAK_CONTAINER=$KEYCLOAK_CONTAINER"
echo

for c in "$APISIX_CONTAINER" "$ETCD_CONTAINER" "$KEYCLOAK_CONTAINER"; do
  if container_running "$c"; then
    echo "OK: container running: $c"
  else
    echo "WARN: container not running or not found: $c"
  fi
done

section "APISIX config snapshot (inside container)"
if container_running "$APISIX_CONTAINER"; then
  echo "# /usr/local/apisix/conf/apisix.yaml (first ~200 lines)"
  exec_in_sh "$APISIX_CONTAINER" "sed -n '1,200p' /usr/local/apisix/conf/apisix.yaml || true"
  echo
  echo "# Grep for deployment/config_provider/etcd"
  exec_in_sh "$APISIX_CONTAINER" "grep -nE 'deployment:|config_provider|etcd:|admin_key|allow_admin|admin_listen' -n /usr/local/apisix/conf/apisix.yaml || true"
else
  echo "SKIP: APISIX container not running"
fi

section "APISIX Admin API key check"
if container_running "$APISIX_CONTAINER"; then
  # In the prod-v1 compose, the key is provided as a Docker secret at /run/secrets/api-key.
  # Many APISIX configs also hardcode admin_key. We compare the secret vs the config value.
  SECRET_KEY=""
  if exec_in_sh "$APISIX_CONTAINER" "test -f /run/secrets/api-key"; then
    SECRET_KEY="$(exec_in_sh "$APISIX_CONTAINER" "cat /run/secrets/api-key" | tr -d '\r\n' || true)"
    echo "Found /run/secrets/api-key (length: ${#SECRET_KEY})"
  else
    echo "WARN: /run/secrets/api-key not present in container"
  fi

  CONFIG_KEY="$(exec_in_sh "$APISIX_CONTAINER" "grep -nE '^[[:space:]]*key:[[:space:]]*' /usr/local/apisix/conf/apisix.yaml | head -n 1 | sed -E 's/.*key:[[:space:]]*\"?([^\" ]+)\"?.*/\1/'" || true)"
  if [ -n "$CONFIG_KEY" ]; then
    echo "First admin key found in config (masked): ${CONFIG_KEY:0:6}...${CONFIG_KEY: -6} (len ${#CONFIG_KEY})"
  else
    echo "WARN: Could not parse an admin key from /usr/local/apisix/conf/apisix.yaml"
  fi

  if [ -n "$SECRET_KEY" ] && [ -n "$CONFIG_KEY" ]; then
    if [ "$SECRET_KEY" = "$CONFIG_KEY" ]; then
      echo "OK: Docker secret admin key matches APISIX config key"
    else
      echo "MISMATCH: Docker secret admin key != APISIX config key"
      echo "This typically causes 401 from Admin API for automation scripts/backends using the secret."
    fi
  fi

  echo
  echo "# Query APISIX Admin API routes list (HTTP status + body head)"
  if [ -n "$SECRET_KEY" ]; then
    curl_in "$APISIX_CONTAINER" "-H 'X-API-KEY: ${SECRET_KEY}' http://127.0.0.1:9180/apisix/admin/routes"
  else
    echo "SKIP: no admin key available to test Admin API"
  fi
fi

section "ETCD contents (APISIX keys)"
if container_running "$ETCD_CONTAINER"; then
  echo "# etcd endpoint health"
  exec_in_sh "$ETCD_CONTAINER" "/usr/local/bin/etcdctl --endpoints=http://127.0.0.1:2379 endpoint health || true"
  echo
  echo "# Count keys under /apisix (if any)"
  exec_in_sh "$ETCD_CONTAINER" "/usr/local/bin/etcdctl --endpoints=http://127.0.0.1:2379 get --prefix /apisix --keys-only | wc -l | xargs echo 'keys:' || true"
  echo
  echo "# Show first 50 keys under /apisix"
  exec_in_sh "$ETCD_CONTAINER" "/usr/local/bin/etcdctl --endpoints=http://127.0.0.1:2379 get --prefix /apisix --keys-only | head -n 50 || true"
else
  echo "SKIP: ETCD container not running"
fi

section "Keycloak readiness + base path check"
if container_running "$KEYCLOAK_CONTAINER"; then
  echo "# Keycloak readiness (HTTPS)"
  # Keycloak in prod-v1 is started with --http-relative-path=/auth and HTTP disabled.
  curl_in "$KEYCLOAK_CONTAINER" "-k https://127.0.0.1:8443/auth/health/ready"
  echo
  echo "# Keycloak realm discovery (platform default realm endpoints)"
  curl_in "$KEYCLOAK_CONTAINER" "-k https://127.0.0.1:8443/auth/realms/thaliumx/.well-known/openid-configuration"
else
  echo "SKIP: Keycloak container not running"
fi

section "APISIX -> Keycloak upstream test (from inside APISIX container)"
if container_running "$APISIX_CONTAINER"; then
  echo "# Try reaching Keycloak HTTPS directly from APISIX"
  curl_in "$APISIX_CONTAINER" "-k https://${KEYCLOAK_CONTAINER}:8443/auth/health/ready"
  echo
  echo "# Try reaching Keycloak over *HTTP* on 8443 (should FAIL if Keycloak is HTTPS-only)"
  curl_in "$APISIX_CONTAINER" "http://${KEYCLOAK_CONTAINER}:8443/auth/health/ready"
else
  echo "SKIP: APISIX container not running"
fi

section "Public routing probes via APISIX (Host header simulation)"
if container_running "$APISIX_CONTAINER"; then
  echo "# thaliumx.com -> should usually be Frontend (HTML), not Backend JSON"
  curl_in "$APISIX_CONTAINER" "-H 'Host: thaliumx.com' http://127.0.0.1:9080/"
  echo
  echo "# thal.thaliumx.com -> should rewrite to /token-presale on frontend"
  curl_in "$APISIX_CONTAINER" "-H 'Host: thal.thaliumx.com' http://127.0.0.1:9080/"
  echo
  echo "# auth.thaliumx.com -> should proxy to Keycloak /auth/..."
  curl_in "$APISIX_CONTAINER" "-H 'Host: auth.thaliumx.com' http://127.0.0.1:9080/auth/health/ready"
else
  echo "SKIP: APISIX container not running"
fi

echo
echo "=== Diagnostics complete ==="

