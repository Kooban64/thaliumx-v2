#!/usr/bin/env sh
set -eu

# Applies ThaliumX login/account/admin/email themes to the target Keycloak realm.
# Intended to run as a one-shot post-import init job in prod-v1.

KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak:8080/auth}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-thaliumx}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
KEYCLOAK_ADMIN_PASSWORD_FILE="${KEYCLOAK_ADMIN_PASSWORD_FILE:-/run/secrets/keycloak-admin-password}"
KEYCLOAK_THEME_NAME="${KEYCLOAK_THEME_NAME:-thaliumx}"

if [ ! -f "${KEYCLOAK_ADMIN_PASSWORD_FILE}" ]; then
  echo "ERROR: admin password file not found: ${KEYCLOAK_ADMIN_PASSWORD_FILE}" >&2
  exit 1
fi

KEYCLOAK_ADMIN_PASSWORD="$(cat "${KEYCLOAK_ADMIN_PASSWORD_FILE}")"

echo "[theme-seed] Waiting for Keycloak realm endpoint to be ready..."
i=0
until [ "$i" -ge 60 ]; do
  if curl -fsS "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$i" -ge 60 ]; then
  echo "ERROR: Keycloak realm '${KEYCLOAK_REALM}' not ready at ${KEYCLOAK_URL}" >&2
  exit 1
fi

echo "[theme-seed] Authenticating with kcadm..."
/opt/keycloak/bin/kcadm.sh config credentials \
  --server "${KEYCLOAK_URL}" \
  --realm master \
  --user "${KEYCLOAK_ADMIN_USER}" \
  --password "${KEYCLOAK_ADMIN_PASSWORD}"

echo "[theme-seed] Applying theme settings to realm '${KEYCLOAK_REALM}'..."
/opt/keycloak/bin/kcadm.sh update "realms/${KEYCLOAK_REALM}" \
  -s "displayName=ThaliumX Identity" \
  -s "displayNameHtml=<div class='tx-brand'>ThaliumX</div>" \
  -s "loginTheme=${KEYCLOAK_THEME_NAME}" \
  -s "accountTheme=${KEYCLOAK_THEME_NAME}" \
  -s "adminTheme=${KEYCLOAK_THEME_NAME}" \
  -s "emailTheme=${KEYCLOAK_THEME_NAME}"

echo "[theme-seed] Theme '${KEYCLOAK_THEME_NAME}' applied to realm '${KEYCLOAK_REALM}'."

