#!/bin/bash
# Thaliumx Vault Production Unseal Script
# =======================================
# Unseals Vault for production use
# Run after Vault initialization
# Updated: 2025-12-17T08:13:55.000Z

set -e

VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}"
INIT_OUTPUT_FILE="/vault/file/init-keys-production.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Vault is sealed
check_seal_status() {
    log_step "Checking Vault seal status..."

    if vault status -address="$VAULT_ADDR" --tls-skip-verify 2>&1 | grep -q "Sealed.*false"; then
        log_info "Vault is already unsealed"
        return 0
    fi

    log_info "Vault is sealed, proceeding with unseal..."
    return 1
}

# Unseal Vault
unseal_vault() {
    if [ ! -f "$INIT_OUTPUT_FILE" ]; then
        log_error "Init keys file not found: $INIT_OUTPUT_FILE"
        log_error "Please ensure Vault has been initialized first"
        exit 1
    fi

    log_info "Unsealing Vault..."

    # Extract unseal keys
    UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' "$INIT_OUTPUT_FILE")
    UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' "$INIT_OUTPUT_FILE")
    UNSEAL_KEY_3=$(jq -r '.unseal_keys_b64[2]' "$INIT_OUTPUT_FILE")

    # Unseal with required keys (threshold = 3)
    vault operator unseal -address="$VAULT_ADDR" --tls-skip-verify "$UNSEAL_KEY_1"
    vault operator unseal -address="$VAULT_ADDR" --tls-skip-verify "$UNSEAL_KEY_2"
    vault operator unseal -address="$VAULT_ADDR" --tls-skip-verify "$UNSEAL_KEY_3"

    log_info "Vault unsealed successfully"
}

# Verify unseal
verify_unseal() {
    log_step "Verifying Vault is unsealed..."

    if vault status -address="$VAULT_ADDR" --tls-skip-verify 2>&1 | grep -q "Sealed.*false"; then
        log_info "✅ Vault unseal verification successful"
        return 0
    else
        log_error "❌ Vault unseal verification failed"
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting Vault production unseal process..."

    if check_seal_status; then
        log_info "Vault is already unsealed, no action needed"
        exit 0
    fi

    unseal_vault

    if verify_unseal; then
        log_info "🎉 Vault production unseal complete!"
        log_info "Vault is now ready for use"
    else
        log_error "Vault unseal failed"
        exit 1
    fi
}

main "$@"
