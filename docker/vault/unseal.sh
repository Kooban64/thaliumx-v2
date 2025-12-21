#!/bin/bash
# ThaliumX Vault Auto-Unseal Script
# Production-ready auto-unsealing with secure key management

set -e

VAULT_ADDR=${VAULT_ADDR:-https://127.0.0.1:8200}
VAULT_CACERT=${VAULT_CACERT:-/vault/userconfig/tls/ca.crt}
KEYS_FILE="/vault/keys/vault-keys.json"
ROOT_TOKEN_FILE="/vault/keys/root-token.txt"

echo "🔐 ThaliumX Vault Auto-Unseal v2.0"
echo "=================================="

# Wait for Vault to be ready
echo "⏳ Waiting for Vault to be ready..."
timeout=60
while [ $timeout -gt 0 ]; do
    if vault status -tls-skip-verify >/dev/null 2>&1; then
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
if vault status -tls-skip-verify 2>/dev/null | grep -q "Sealed.*false"; then
    echo "✅ Vault is already unsealed"
    exit 0
fi

# Create keys directory if it doesn't exist
mkdir -p /vault/keys

# Check if Vault is initialized
if vault status -tls-skip-verify 2>/dev/null | grep -q "Initialized.*true"; then
    echo "🔓 Vault is initialized but sealed, attempting to unseal..."
else
    echo "🔧 Vault is not initialized, initializing with production settings..."
    # Initialize with 3 shares, 2 threshold for better security
    INIT_OUTPUT=$(vault operator init -tls-skip-verify -key-shares=3 -key-threshold=2 -format=json)

    # Save keys securely
    echo "$INIT_OUTPUT" > "$KEYS_FILE"
    chmod 600 "$KEYS_FILE"

    # Extract and save root token
    ROOT_TOKEN=$(echo "$INIT_OUTPUT" | jq -r '.root_token')
    echo "$ROOT_TOKEN" > "$ROOT_TOKEN_FILE"
    chmod 600 "$ROOT_TOKEN_FILE"

    echo "✅ Vault initialized. Keys saved securely."
    echo "🔑 Root token saved to $ROOT_TOKEN_FILE"
fi

# Extract unseal keys
if [ -f "$KEYS_FILE" ]; then
    UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' "$KEYS_FILE")
    UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' "$KEYS_FILE")

    if [ -z "$UNSEAL_KEY_1" ] || [ -z "$UNSEAL_KEY_2" ]; then
        echo "❌ Failed to extract unseal keys from $KEYS_FILE"
        exit 1
    fi
else
    echo "❌ Vault keys file not found at $KEYS_FILE"
    echo "💡 This may be the first run. Keys will be generated automatically."
    exit 1
fi

echo "🔑 Applying unseal keys..."

# Apply unseal keys
vault operator unseal -tls-skip-verify "$UNSEAL_KEY_1"
vault operator unseal -tls-skip-verify "$UNSEAL_KEY_2"

# Verify unsealing
if vault status -tls-skip-verify | grep -q "Sealed.*false"; then
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