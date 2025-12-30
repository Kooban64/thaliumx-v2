#!/usr/bin/env bash
set -euo pipefail

# Generates local (gitignored) secret files required to start ZITADEL in prod-v1.
#
# Files created under: ./.secrets/generated/
# - zitadel-masterkey                (32 chars)
# - zitadel-postgres-root-password    (32 chars)
# - zitadel-firstadmin-password       (login password for root@<externalDomain>)
# - zitadel-config-secrets.yaml       (ZITADEL secret config file)
# - zitadel-init-steps.yaml           (ZITADEL init steps file)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

OUT_DIR=".secrets/generated"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR" || true

rand_alnum_32() {
  # Avoid punctuation that can break YAML or shell parsing.
  # Using `od` avoids SIGPIPE issues that happen with `tr | head` under `set -e`.
  od -An -N16 -tx1 /dev/urandom | tr -d ' \n'
}

rand_password_strong() {
  # Ensure ZITADEL default password policy is satisfied (at least one symbol).
  # Prefix guarantees:
  # - upper: A
  # - lower: a
  # - digit: 1
  # - symbol: !
  printf 'Aa1!'
  # Add 28 hex chars => total length = 32
  od -An -N14 -tx1 /dev/urandom | tr -d ' \n'
}

ensure_file() {
  local path="$1"
  if [[ -s "$path" ]]; then
    return 0
  fi
  umask 077
  rand_alnum_32 >"$path"
}

ensure_file_strong_password() {
  local path="$1"
  if [[ -s "$path" ]]; then
    return 0
  fi
  umask 077
  rand_password_strong >"$path"
}

MASTERKEY_FILE="$OUT_DIR/zitadel-masterkey"
POSTGRES_ROOT_PW_FILE="$OUT_DIR/zitadel-postgres-root-password"
FIRSTADMIN_PW_FILE="$OUT_DIR/zitadel-firstadmin-password"

ensure_file "$MASTERKEY_FILE"
ensure_file "$POSTGRES_ROOT_PW_FILE"
  ensure_file_strong_password "$FIRSTADMIN_PW_FILE"

  # APISIX openid-connect plugin requires a non-empty client_secret in its schema.
  # We generate a stable repo-local secret so APISIX route seeding is deterministic.
  APISIX_OIDC_SECRET_FILE="$OUT_DIR/apisix-oidc-client-secret"
  ensure_file "$APISIX_OIDC_SECRET_FILE"

POSTGRES_ROOT_PW="$(cat "$POSTGRES_ROOT_PW_FILE")"

# ZITADEL's init will create the DB/user if missing using the Admin credentials.
# We keep a dedicated DB user for runtime connections.
ZITADEL_DB_USER="zitadel_user"
ZITADEL_DB_PASSWORD_FILE="$OUT_DIR/zitadel-postgres-user-password"
ensure_file "$ZITADEL_DB_PASSWORD_FILE"
ZITADEL_DB_PASSWORD="$(cat "$ZITADEL_DB_PASSWORD_FILE")"

SECRETS_YAML="$OUT_DIR/zitadel-config-secrets.yaml"
STEPS_YAML="$OUT_DIR/zitadel-init-steps.yaml"

umask 077
cat >"$SECRETS_YAML" <<EOF
# ZITADEL secret configuration (generated). Do not commit.

Database:
  postgres:
    User:
      Username: '${ZITADEL_DB_USER}'
      Password: '${ZITADEL_DB_PASSWORD}'
    Admin:
      Username: 'root'
      Password: '${POSTGRES_ROOT_PW}'
EOF

FIRSTADMIN_PW="$(cat "$FIRSTADMIN_PW_FILE")"
cat >"$STEPS_YAML" <<EOF
# ZITADEL init steps (generated). Do not commit.

FirstInstance:
  Org:
    Human:
      # loginname is root@<externalDomain>
      Username: 'root'
      Password: '${FIRSTADMIN_PW}'
EOF

  chmod 600 "$MASTERKEY_FILE" "$POSTGRES_ROOT_PW_FILE" "$FIRSTADMIN_PW_FILE" "$SECRETS_YAML" "$STEPS_YAML" "$ZITADEL_DB_PASSWORD_FILE" "$APISIX_OIDC_SECRET_FILE" || true

echo "OK: Zitadel secret files are present under $OUT_DIR (values not printed)."
echo "INFO: First admin password stored in: $FIRSTADMIN_PW_FILE"
