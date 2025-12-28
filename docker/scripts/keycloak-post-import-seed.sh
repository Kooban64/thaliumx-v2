#!/usr/bin/env bash
set -euo pipefail

# ThaliumX Keycloak Post-Import Seeding
# ====================================
# Purpose:
# - Keycloak realm JSON imports cannot safely embed runtime secrets.
# - This script patches client secrets + redirect URIs AFTER Keycloak starts.
# - Designed to be idempotent.
#
# Runs inside a one-shot container in prod-v1.

KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-https://keycloak:8443/auth}"
KEYCLOAK_RELATIVE_PATH="${KEYCLOAK_HTTP_RELATIVE_PATH:-/auth}"

# TLS/SNI handling
# --------------
# In prod-v1, Keycloak is usually reached inside Docker via https://keycloak:8443,
# but the certificate CN/SAN is typically `auth.thaliumx.com`.
#
# If the hostname in the URL does not match the certificate, `curl` will fail with
# a TLS hostname mismatch.
#
# To keep TLS verification ON while still calling the in-network Keycloak service,
# we support using `curl --resolve` to map the public hostname to the Docker service IP.
KEYCLOAK_DOCKER_HOST="${KEYCLOAK_DOCKER_HOST:-keycloak}"
KEYCLOAK_TLS_HOST="${KEYCLOAK_TLS_HOST:-}"
KEYCLOAK_TLS_PORT="${KEYCLOAK_TLS_PORT:-8443}"

resolve_args=()
if [ -n "$KEYCLOAK_TLS_HOST" ]; then
  kc_ip="$(getent hosts "$KEYCLOAK_DOCKER_HOST" 2>/dev/null | awk '{print $1}' | head -n1 || true)"
  if [ -n "$kc_ip" ]; then
    resolve_args=(--resolve "${KEYCLOAK_TLS_HOST}:${KEYCLOAK_TLS_PORT}:${kc_ip}")
    KEYCLOAK_BASE_URL="https://${KEYCLOAK_TLS_HOST}:${KEYCLOAK_TLS_PORT}${KEYCLOAK_RELATIVE_PATH}"
  else
    echo "WARN: could not resolve KEYCLOAK_DOCKER_HOST=$KEYCLOAK_DOCKER_HOST; falling back to KEYCLOAK_BASE_URL=$KEYCLOAK_BASE_URL" >&2
  fi
fi

kc_curl() {
  # shellcheck disable=SC2068
  curl -fsS ${resolve_args[@]} "$@"
}

# Realms to patch
# Single-realm mode: we standardize on ONE realm for all application auth.
REALMS=(
  "${KEYCLOAK_PLATFORM_REALM:-thaliumx-platform}"
)

ADMIN_USER_FILE="${KEYCLOAK_ADMIN_USERNAME_FILE:-/run/secrets/keycloak-admin-username}"
ADMIN_PASS_FILE="${KEYCLOAK_ADMIN_PASSWORD_FILE:-/run/secrets/keycloak-admin-password}"
BACKEND_SECRET_FILE="${KEYCLOAK_BACKEND_SECRET_FILE:-/run/secrets/keycloak-backend-secret}"

# Optional service client secrets (only used if these clients are enabled).
TRADING_SECRET_FILE="${KEYCLOAK_TRADING_CLIENT_SECRET_FILE:-/run/secrets/keycloak-trading-secret}"
FINTECH_SECRET_FILE="${KEYCLOAK_FINTECH_CLIENT_SECRET_FILE:-/run/secrets/keycloak-fintech-secret}"

ADMIN_USER="$(cat "$ADMIN_USER_FILE" | tr -d '\r\n')"
ADMIN_PASS="$(cat "$ADMIN_PASS_FILE" | tr -d '\r\n')"
BACKEND_SECRET="$(cat "$BACKEND_SECRET_FILE" | tr -d '\r\n')"

TRADING_SECRET=""
if [ -f "$TRADING_SECRET_FILE" ]; then
  TRADING_SECRET="$(cat "$TRADING_SECRET_FILE" | tr -d '\r\n')"
fi

FINTECH_SECRET=""
if [ -f "$FINTECH_SECRET_FILE" ]; then
  FINTECH_SECRET="$(cat "$FINTECH_SECRET_FILE" | tr -d '\r\n')"
fi

require_bin() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing required binary: $1" >&2; exit 1; }
}

require_bin curl
require_bin jq

echo "=== Keycloak post-import seeding ==="
echo "KEYCLOAK_BASE_URL=$KEYCLOAK_BASE_URL"

# Keycloak exposes health endpoints on the management interface (default: :9000).
# In this stack we run Keycloak with `--http-relative-path=/auth`, and that prefix
# is applied to the management interface too.
ready_url="${KEYCLOAK_HEALTH_URL:-https://keycloak:9000${KEYCLOAK_RELATIVE_PATH}/health/ready}"
echo "Waiting for Keycloak readiness: $ready_url"
for i in $(seq 1 60); do
  if kc_curl "$ready_url" >/dev/null 2>&1; then
    echo "Keycloak is ready"
    break
  fi
  echo "  attempt $i/60..."
  sleep 2
done

token_url="$KEYCLOAK_BASE_URL/realms/master/protocol/openid-connect/token"
echo "Requesting admin token: $token_url"

ACCESS_TOKEN="$(
  kc_curl -X POST "$token_url" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "grant_type=password" \
    --data-urlencode "client_id=admin-cli" \
    --data-urlencode "username=$ADMIN_USER" \
    --data-urlencode "password=$ADMIN_PASS" \
  | jq -r '.access_token'
)"

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "ERROR: failed to obtain admin token" >&2
  exit 1
fi

authz=(-H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json')

disable_legacy_realm() {
  local legacy_realm="$1"
  echo
  echo "--- Checking legacy realm: ${legacy_realm} ---"

  # Does the realm exist?
  if ! kc_curl "${KEYCLOAK_BASE_URL}/admin/realms/${legacy_realm}" "${authz[@]}" >/tmp/legacy-realm.json 2>/dev/null; then
    echo "OK: legacy realm ${legacy_realm} not found (nothing to do)"
    return 0
  fi

  # If it exists, disable it so no new logins/tokens come from it.
  enabled="$(jq -r '.enabled // false' /tmp/legacy-realm.json)"
  if [ "$enabled" = "false" ]; then
    echo "OK: legacy realm ${legacy_realm} already disabled"
    return 0
  fi

  echo "WARN: legacy realm ${legacy_realm} exists and is enabled -> disabling"
  updated="$(
    jq -c \
      '.enabled=false
       | .attributes = (.attributes // {})
       | .attributes["thaliumx.deprecated"] = "true"' \
      /tmp/legacy-realm.json
  )"

  kc_curl -X PUT "${KEYCLOAK_BASE_URL}/admin/realms/${legacy_realm}" "${authz[@]}" -d "$updated" >/dev/null
  echo "OK: legacy realm ${legacy_realm} disabled"
}

# Guardrail: disable the legacy realm if it exists.
# We are standardizing on one realm only:
# - thaliumx-platform
disable_legacy_realm "thaliumx"
disable_legacy_realm "thaliumx-default-tenant"

patch_realm_smtp() {
  local realm="$1"

  # Read SMTP config from environment (secrets should be exported by the compose job).
  local smtp_host="${SMTP_HOST:-}"
  local smtp_port="${SMTP_PORT:-}"
  local smtp_from="${SMTP_FROM:-}"
  local smtp_user="${SMTP_USER:-}"
  local smtp_pass="${SMTP_PASSWORD:-}"

  if [ -z "$smtp_host" ] || [ -z "$smtp_port" ] || [ -z "$smtp_from" ] || [ -z "$smtp_user" ] || [ -z "$smtp_pass" ]; then
    echo "WARN: SMTP_* not fully set; skipping SMTP patch for realm $realm" >&2
    return 0
  fi

  echo "Patching SMTP settings in realm $realm (host=$smtp_host, port=$smtp_port, from=$smtp_from, user=$smtp_user)"

  if ! kc_curl "${KEYCLOAK_BASE_URL}/admin/realms/${realm}" "${authz[@]}" >/tmp/realm.json 2>/dev/null; then
    echo "WARN: failed to read realm $realm; skipping SMTP patch" >&2
    return 0
  fi

  updated="$(
    jq -c \
      --arg host "$smtp_host" \
      --arg port "$smtp_port" \
      --arg from "$smtp_from" \
      --arg user "$smtp_user" \
      --arg pass "$smtp_pass" \
      '.smtpServer = (
        .smtpServer // {}
        | .host=$host
        | .port=$port
        | .from=$from
        | .user=$user
        | .password=$pass
        | .auth="true"
        | .starttls="true"
        | .ssl="false"
      )' \
      /tmp/realm.json
  )"

  kc_curl -X PUT "${KEYCLOAK_BASE_URL}/admin/realms/${realm}" "${authz[@]}" -d "$updated" >/dev/null
  echo "OK: SMTP settings patched in realm $realm"
}

get_client_id() {
  local realm="$1"
  local clientId="$2"
  kc_curl "${KEYCLOAK_BASE_URL}/admin/realms/${realm}/clients?clientId=${clientId}" "${authz[@]}" \
    | jq -r '.[0].id // empty'
}

get_client_json() {
  local realm="$1"
  local id="$2"
  kc_curl "${KEYCLOAK_BASE_URL}/admin/realms/${realm}/clients/${id}" "${authz[@]}"
}

put_client_json() {
  local realm="$1"
  local id="$2"
  local json="$3"
  kc_curl -X PUT "${KEYCLOAK_BASE_URL}/admin/realms/${realm}/clients/${id}" "${authz[@]}" -d "$json" >/dev/null
}

get_user_id_by_email() {
  local realm="$1"
  local email="$2"
  kc_curl "${KEYCLOAK_BASE_URL}/admin/realms/${realm}/users?email=${email}" "${authz[@]}" \
    | jq -r '.[0].id // empty'
}

get_realm_role_json() {
  local realm="$1"
  local role="$2"
  kc_curl "${KEYCLOAK_BASE_URL}/admin/realms/${realm}/roles/${role}" "${authz[@]}"
}

ensure_user_has_realm_role() {
  local realm="$1"
  local email="$2"
  local role="$3"

  local uid
  uid="$(get_user_id_by_email "$realm" "$email")"
  if [ -z "$uid" ]; then
    echo "WARN: user $email not found in realm $realm (skipping role assignment)" >&2
    return 0
  fi

  local role_json
  role_json="$(get_realm_role_json "$realm" "$role" | jq -c '{id,name}')"

  # Assign role (idempotent: Keycloak ignores duplicates)
  kc_curl -X POST "${KEYCLOAK_BASE_URL}/admin/realms/${realm}/users/${uid}/role-mappings/realm" \
    "${authz[@]}" \
    -d "[$role_json]" >/dev/null || true
  echo "OK: ensured $email has realm role $role in $realm"
}

ensure_array_contains() {
  # jq filter helper: ensure array contains a value
  # usage in jq: ( .redirectUris | ensure_array_contains("x") )
  cat <<'JQ'
def ensure_array_contains(v):
  if . == null then [v]
  elif (type != "array") then .
  elif any(.[]; . == v) then .
  else . + [v]
  end;
JQ
}

for realm in "${REALMS[@]}"; do
  echo
  echo "--- Patching realm: $realm ---"

  # 1) Patch backend client secret
  backend_client_id="$(get_client_id "$realm" 'thaliumx-backend')"
  if [ -z "$backend_client_id" ]; then
    echo "WARN: client thaliumx-backend not found in realm $realm (skipping)"
  else
    echo "Updating thaliumx-backend secret in $realm"
    backend_json="$(get_client_json "$realm" "$backend_client_id")"
    backend_updated="$(
      jq -c \
        --arg secret "$BACKEND_SECRET" \
        '.secret=$secret
         | .publicClient=false
         | .clientAuthenticatorType="client-secret"
         | .standardFlowEnabled=false
         | .directAccessGrantsEnabled=true
         | .serviceAccountsEnabled=true
         | .bearerOnly=false' \
        <<<"$backend_json"
    )"
    put_client_json "$realm" "$backend_client_id" "$backend_updated"
    echo "OK: thaliumx-backend updated"
  fi

  # 2) Patch frontend redirect URIs + web origins
  frontend_client_id="$(get_client_id "$realm" 'thaliumx-frontend')"
  if [ -z "$frontend_client_id" ]; then
    echo "WARN: client thaliumx-frontend not found in realm $realm (skipping)"
  else
    echo "Ensuring thaliumx-frontend redirectUris/webOrigins in $realm"
    frontend_json="$(get_client_json "$realm" "$frontend_client_id")"

    # Required production origins
    prod_redirect_1='https://thaliumx.com/*'
    prod_redirect_2='https://thal.thaliumx.com/*'
    prod_origin_1='https://thaliumx.com'
    prod_origin_2='https://thal.thaliumx.com'
    # Ensure user access tokens contain backend audience (required for strict API validation)
    prod_scope_1='thaliumx-api'

    frontend_updated="$(
      jq -c \
        --arg r1 "$prod_redirect_1" \
        --arg r2 "$prod_redirect_2" \
        --arg o1 "$prod_origin_1" \
        --arg o2 "$prod_origin_2" \
        --arg s1 "$prod_scope_1" \
        "$(ensure_array_contains)\
         .publicClient=true
          | .redirectUris = (.redirectUris | ensure_array_contains(\$r1) | ensure_array_contains(\$r2))
          | .webOrigins   = (.webOrigins   | ensure_array_contains(\$o1) | ensure_array_contains(\$o2))
          | .defaultClientScopes = (.defaultClientScopes | ensure_array_contains(\$s1))" \
        <<<"$frontend_json"
    )"
    put_client_json "$realm" "$frontend_client_id" "$frontend_updated"
    echo "OK: thaliumx-frontend updated"
  fi

  # 3) Patch optional trading/fintech confidential clients (service accounts)
  if [ -n "$TRADING_SECRET" ]; then
    trading_client_id="$(get_client_id "$realm" 'thaliumx-trading')"
    if [ -z "$trading_client_id" ]; then
      echo "WARN: client thaliumx-trading not found in realm $realm (skipping)"
    else
      echo "Updating thaliumx-trading secret in $realm"
      trading_json="$(get_client_json "$realm" "$trading_client_id")"
      trading_updated="$(
        jq -c \
          --arg secret "$TRADING_SECRET" \
          '.secret=$secret
           | .publicClient=false
           | .clientAuthenticatorType="client-secret"
           | .standardFlowEnabled=false
           | .directAccessGrantsEnabled=false
           | .serviceAccountsEnabled=true
           | .bearerOnly=false' \
          <<<"$trading_json"
      )"
      put_client_json "$realm" "$trading_client_id" "$trading_updated"
      echo "OK: thaliumx-trading updated"
    fi
  else
    echo "INFO: no trading client secret provided; skipping thaliumx-trading patch"
  fi

  if [ -n "$FINTECH_SECRET" ]; then
    fintech_client_id="$(get_client_id "$realm" 'thaliumx-fintech')"
    if [ -z "$fintech_client_id" ]; then
      echo "WARN: client thaliumx-fintech not found in realm $realm (skipping)"
    else
      echo "Updating thaliumx-fintech secret in $realm"
      fintech_json="$(get_client_json "$realm" "$fintech_client_id")"
      fintech_updated="$(
        jq -c \
          --arg secret "$FINTECH_SECRET" \
          '.secret=$secret
           | .publicClient=false
           | .clientAuthenticatorType="client-secret"
           | .standardFlowEnabled=false
           | .directAccessGrantsEnabled=false
           | .serviceAccountsEnabled=true
           | .bearerOnly=false' \
          <<<"$fintech_json"
      )"
      put_client_json "$realm" "$fintech_client_id" "$fintech_updated"
      echo "OK: thaliumx-fintech updated"
    fi
  else
    echo "INFO: no fintech client secret provided; skipping thaliumx-fintech patch"
  fi

  # 4) Patch SMTP realm settings from secrets/env.
  patch_realm_smtp "$realm"
done

echo
echo "=== Keycloak post-import seeding complete ==="
