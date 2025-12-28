#!/bin/bash
# ThaliumX Vault Auto-Unseal Script
# Production-ready auto-unsealing with secure key management

set -euo pipefail

VAULT_ADDR=${VAULT_ADDR:-https://127.0.0.1:8200}
VAULT_CACERT=${VAULT_CACERT:-/vault/userconfig/tls/ca.crt}
KEYS_FILE="/vault/keys/vault-keys.json"
ROOT_TOKEN_FILE="/vault/keys/root-token.txt"

# Defaults used when Vault is not initialized yet.
# NOTE: These should match your operational security posture.
VAULT_INIT_KEY_SHARES=${VAULT_INIT_KEY_SHARES:-5}
VAULT_INIT_KEY_THRESHOLD=${VAULT_INIT_KEY_THRESHOLD:-3}

get_vault_status_json() {
  # Return Vault status JSON even when Vault is sealed.
  # `vault status` exits 2 when sealed, which must NOT trip `set -e`/`pipefail`.
  local out rc
  set +e
  out=$(vault status -tls-skip-verify -format=json 2>/dev/null)
  rc=$?
  set -e
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ]; then
    return "$rc"
  fi
  printf '%s' "$out"
}

echo "🔐 ThaliumX Vault Auto-Unseal v2.0"
echo "=================================="

# Wait for Vault to be ready
echo "⏳ Waiting for Vault to be ready..."
timeout=60
while [ $timeout -gt 0 ]; do
    # IMPORTANT:
    # `vault status` returns:
    # - 0 when unsealed
    # - 2 when sealed (but reachable/responding)
    # This script must treat both as "Vault is responding", otherwise it will
    # time out forever when Vault is sealed.
    if get_vault_status_json >/dev/null 2>&1; then
        echo "✅ Vault is responding"
        break
    fi
    echo "⏳ Waiting for Vault... ($timeout seconds remaining)"
    sleep 5
    timeout=$((timeout - 5))
done

if [ $timeout -le 0 ]; then
    echo "❌ Vault failed to respond within timeout"
    exit 1
fi

# Check if Vault is already unsealed
STATUS_JSON="$(get_vault_status_json)"
if echo "$STATUS_JSON" | jq -e '.sealed == false' >/dev/null 2>&1; then
    echo "✅ Vault is already unsealed"
    exit 0
fi

# Create keys directory if it doesn't exist
mkdir -p /vault/keys

# Check if Vault is initialized
if echo "$STATUS_JSON" | jq -e '.initialized == true' >/dev/null 2>&1; then
    echo "🔓 Vault is initialized but sealed, attempting to unseal..."
else
    echo "🔧 Vault is not initialized, initializing with production settings..."
    # Initialize with N shares and T threshold.
    INIT_OUTPUT=$(vault operator init -tls-skip-verify -key-shares="$VAULT_INIT_KEY_SHARES" -key-threshold="$VAULT_INIT_KEY_THRESHOLD" -format=json)

    # Save keys securely
    echo "$INIT_OUTPUT" > "$KEYS_FILE"
    chmod 600 "$KEYS_FILE"

    # Extract and save root token
    ROOT_TOKEN=$(echo "$INIT_OUTPUT" | jq -r '.root_token')
    echo "$ROOT_TOKEN" > "$ROOT_TOKEN_FILE"
    chmod 600 "$ROOT_TOKEN_FILE"

    echo "✅ Vault initialized. Keys saved securely."
    echo "🔑 Root token saved to $ROOT_TOKEN_FILE"

    # Refresh status after init so we can read the correct threshold (t).
    STATUS_JSON="$(get_vault_status_json)"
fi

T=$(echo "$STATUS_JSON" | jq -r '.t // 0')
if [ -z "$T" ] || [ "$T" = "null" ] || [ "$T" -le 0 ]; then
  echo "❌ Could not determine Vault unseal threshold from status JSON" >&2
  exit 1
fi

# Collect unseal keys
declare -a UNSEAL_KEYS

if [ -f "$KEYS_FILE" ]; then
  # Standard init output format
  mapfile -t UNSEAL_KEYS < <(jq -r '.unseal_keys_b64[]? // empty' "$KEYS_FILE")
else
  # Fallback: allow providing keys via Docker secrets
  # (Recommended for recovering an already-initialized Vault where the init JSON was never persisted.)
  for i in $(seq 1 10); do
    f="/run/secrets/vault-unseal-key-$i"
    if [ -f "$f" ]; then
      UNSEAL_KEYS+=("$(cat "$f" | tr -d '\r\n')")
    fi
  done

  # Persist keys to KEYS_FILE for future boots (optional, but makes the stack self-healing).
  if [ "${#UNSEAL_KEYS[@]}" -gt 0 ]; then
    jq -n --argjson keys "$(printf '%s\n' "${UNSEAL_KEYS[@]}" | jq -R . | jq -s .)" '{unseal_keys_b64:$keys}' > "$KEYS_FILE"
    chmod 600 "$KEYS_FILE"
  fi
fi

if [ "${#UNSEAL_KEYS[@]}" -lt "$T" ]; then
  echo "❌ Not enough unseal keys available to unseal Vault (need threshold=$T, have=${#UNSEAL_KEYS[@]})." >&2
  echo "💡 Provide keys via $KEYS_FILE or Docker secrets (/run/secrets/vault-unseal-key-1..$T)." >&2
  exit 1
fi

echo "🔑 Applying $T unseal keys..."
for i in $(seq 1 "$T"); do
  vault operator unseal -tls-skip-verify "${UNSEAL_KEYS[$((i-1))]}" >/dev/null
done

# Verify unsealing
if get_vault_status_json | jq -e '.sealed == false' >/dev/null 2>&1; then
    echo "✅ Vault successfully unsealed!"

    # Display root token location (but not the token itself for security)
    if [ -f "$ROOT_TOKEN_FILE" ]; then
        echo "🔑 Root token available at $ROOT_TOKEN_FILE"
    fi

    echo "🚀 Vault is ready for use!"
    exit 0
else
    echo "❌ Vault unsealing failed"
    echo "🔍 Check Vault logs for details"
    exit 1
fi
