#!/usr/bin/env bash

# ThaliumX Gateway Smoke Test
# ===========================
# Purpose: validate critical user-facing routing + auth endpoints through APISIX.
#
# Expected environment:
# - APISIX is reachable on https://localhost (or set BASE_URL)
# - Correct Host headers map to APISIX routes
# - Backend is reachable via APISIX routes

set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_http() {
  local expected="$1"
  shift
  local code
  code=$(curl -sk -o /dev/null -w "%{http_code}" "$@" || true)
  if [[ "$code" != "$expected" ]]; then
    echo "Expected HTTP $expected, got $code for: curl $*" >&2
    return 1
  fi
}

echo "== ThaliumX APISIX Smoke Test =="
echo "BASE_URL=$BASE_URL"

echo "[1/8] /health (thaliumx.com)"
assert_http 200 -H 'Host: thaliumx.com' "$BASE_URL/health" || fail "/health should be 200"

echo "[2/8] /api/csrf-token (thaliumx.com)"
csrf_json=$(curl -sk -H 'Host: thaliumx.com' "$BASE_URL/api/csrf-token")
echo "$csrf_json" | grep -q '"csrfToken"' || fail "csrfToken missing in response"

echo "[3/8] /api/auth/login (thaliumx.com) should NOT be 502/429"
login_code=$(curl -sk -o /dev/null -w "%{http_code}" \
  -H 'Host: thaliumx.com' \
  -H 'Content-Type: application/json' \
  -d '{"email":"nope@example.com","password":"wrong"}' \
  "$BASE_URL/api/auth/login" || true)
case "$login_code" in
  400|401|410) : ;; # expected (410 = legacy auth disabled)
  429) fail "login is rate-limited too aggressively (429)" ;;
  502) fail "gateway cannot reach backend (502)" ;;
  *) fail "unexpected login status: $login_code" ;;
esac

echo "[4/8] /api/auth/profile (thaliumx.com) should be 401 (no token)"
assert_http 401 -H 'Host: thaliumx.com' "$BASE_URL/api/auth/profile" || fail "/api/auth/profile should be 401"

echo "[5/8] Presale routing: thal.thaliumx.com/ should serve /token-presale"
assert_http 200 -H 'Host: thal.thaliumx.com' "$BASE_URL/" || fail "thal.thaliumx.com root should be 200"

echo "[6/8] Presale page direct: thal.thaliumx.com/token-presale should be 200"
assert_http 200 -H 'Host: thal.thaliumx.com' "$BASE_URL/token-presale" || fail "/token-presale should be 200"

echo "[7/8] Presale status API (public) should be 200"
assert_http 200 -H 'Host: thal.thaliumx.com' -H 'X-Tenant-ID: 10000000-0000-0000-0000-000000000000' "$BASE_URL/api/presale/status" || fail "/api/presale/status should be 200"

echo "[8/8] Keycloak OIDC discovery should be reachable via gateway"
assert_http 200 -H 'Host: auth.thaliumx.com' "$BASE_URL/auth/realms/thaliumx-platform/.well-known/openid-configuration" || fail "OIDC discovery should be 200"

echo "PASS: gateway smoke checks succeeded"
