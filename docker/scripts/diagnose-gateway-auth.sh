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

# Single-realm mode default
KEYCLOAK_REALM="${KEYCLOAK_REALM:-thaliumx-platform}"

CONF_PATH="${CONF_PATH:-/usr/local/apisix/conf/config.yaml}"

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

container_ip() {
  local name="$1"
  docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$name" 2>/dev/null || true
}

have_curl() {
  command -v curl >/dev/null 2>&1
}

curl_host() {
  # Usage: curl_host <curl args...>
  if ! have_curl; then
    echo "ERROR: curl is required on the host for this diagnostics script" >&2
    return 1
  fi

  # Print both status + first lines of body.
  curl -sS -D /tmp/headers.txt -o /tmp/body.txt "$@" || true
  head -n 20 /tmp/headers.txt || true
  echo
  head -n 60 /tmp/body.txt || true
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
  echo "# $CONF_PATH (first ~220 lines)"
  exec_in_sh "$APISIX_CONTAINER" "sed -n '1,220p' $CONF_PATH || true"
  echo
  echo "# Grep for deployment/config_provider/etcd"
  exec_in_sh "$APISIX_CONTAINER" "grep -nE 'deployment:|config_provider|etcd:|endpoints:|prefix:|admin_key|allow_admin|admin_listen|port_admin' -n $CONF_PATH || true"
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

  CONFIG_KEY="$(exec_in_sh "$APISIX_CONTAINER" "grep -nE '^[[:space:]]*key:[[:space:]]*' $CONF_PATH | head -n 1 | sed -E 's/.*key:[[:space:]]*\"?([^\" ]+)\"?.*/\1/'" || true)"
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
  if [ -z "$SECRET_KEY" ]; then
    echo "SKIP: no admin key available to test Admin API"
  else
    APISIX_IP="$(container_ip "$APISIX_CONTAINER")"
    if [ -z "$APISIX_IP" ]; then
      echo "WARN: could not determine APISIX container IP; skipping Admin API probe"
    else
      # Admin API is not published to the host; this uses the container's bridge IP.
      curl_host -H "X-API-KEY: ${SECRET_KEY}" "http://${APISIX_IP}:9180/apisix/admin/routes"
    fi
  fi
fi

section "ETCD contents (APISIX keys)"
if container_running "$ETCD_CONTAINER"; then
  echo "# etcd endpoint health"
  # etcd image in this stack is distroless-ish (no shell), so call etcdctl directly.
  docker exec "$ETCD_CONTAINER" /usr/local/bin/etcdctl --endpoints=http://127.0.0.1:2379 endpoint health || true
  echo
  echo "# Count keys under /apisix (if any)"
  keys_count="$(docker exec "$ETCD_CONTAINER" /usr/local/bin/etcdctl --endpoints=http://127.0.0.1:2379 get --prefix /apisix --keys-only | wc -l || true)"
  echo "keys: ${keys_count:-unknown}"
  echo
  echo "# Show first 50 keys under /apisix"
  docker exec "$ETCD_CONTAINER" /usr/local/bin/etcdctl --endpoints=http://127.0.0.1:2379 get --prefix /apisix --keys-only | head -n 50 || true
else
  echo "SKIP: ETCD container not running"
fi

section "Keycloak readiness + base path check"
if container_running "$KEYCLOAK_CONTAINER"; then
  echo "# Keycloak readiness (HTTPS)"
  # Keycloak in prod-v1 is started with --http-relative-path=/auth and HTTP disabled.
  KEYCLOAK_IP="$(container_ip "$KEYCLOAK_CONTAINER")"
  if [ -n "$KEYCLOAK_IP" ]; then
    # NOTE: In this stack Keycloak's management interface listens on :9000 (HTTPS)
    # and health endpoints are exposed under the relative path too: /auth/health/ready.
    curl_host -k "https://${KEYCLOAK_IP}:9000/auth/health/ready"
  else
    echo "WARN: could not determine Keycloak container IP; skipping readiness probe"
  fi
  echo
  echo "# Keycloak realm discovery (${KEYCLOAK_REALM})"
  if [ -n "$KEYCLOAK_IP" ]; then
    curl_host -k "https://${KEYCLOAK_IP}:8443/auth/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration"
  fi
else
  echo "SKIP: Keycloak container not running"
fi

section "APISIX -> Keycloak upstream test (via APISIX public endpoint)"
echo "# auth.thaliumx.com -> should proxy to Keycloak /auth/... (OIDC discovery)"
curl_host -k -H 'Host: auth.thaliumx.com' "https://localhost/auth/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration"

section "Public routing probes via APISIX (Host header simulation)"
echo "# thaliumx.com -> should usually be Frontend (HTML), not Backend JSON"
curl_host -k -H 'Host: thaliumx.com' https://localhost/
echo
echo "# thal.thaliumx.com -> should rewrite to /token-presale on frontend"
curl_host -k -H 'Host: thal.thaliumx.com' https://localhost/

echo
echo "=== Diagnostics complete ==="
