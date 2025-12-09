#!/bin/bash
# Thaliumx Vault Unseal Script
# ============================
# This script unseals Vault using stored keys or manual input

set -e

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
INIT_OUTPUT_FILE="/vault/file/init-keys.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Vault is already unsealed
check_seal_status() {
    if vault status -address="$VAULT_ADDR" 2>&1 | grep -q "Sealed.*false"; then
        log_info "Vault is already unsealed"
        exit 0
    fi
}

# Unseal using stored keys
unseal_with_stored_keys() {
    if [ ! -f "$INIT_OUTPUT_FILE" ]; then
        return 1
    fi
    
    log_info "Using stored unseal keys..."
    
    UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' "$INIT_OUTPUT_FILE")
    UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' "$INIT_OUTPUT_FILE")
    UNSEAL_KEY_3=$(jq -r '.unseal_keys_b64[2]' "$INIT_OUTPUT_FILE")
    
    vault operator unseal -address="$VAULT_ADDR" "$UNSEAL_KEY_1" > /dev/null
    vault operator unseal -address="$VAULT_ADDR" "$UNSEAL_KEY_2" > /dev/null
    vault operator unseal -address="$VAULT_ADDR" "$UNSEAL_KEY_3" > /dev/null
    
    return 0
}

# Unseal with manual key input
unseal_with_manual_keys() {
    log_info "Manual unseal mode"
    log_info "Enter 3 unseal keys (threshold is 3):"
    
    for i in 1 2 3; do
        echo -n "Unseal Key $i: "
        read -s UNSEAL_KEY
        echo ""
        vault operator unseal -address="$VAULT_ADDR" "$UNSEAL_KEY"
    done
}

# Main execution
main() {
    log_info "Checking Vault seal status..."
    
    check_seal_status
    
    if unseal_with_stored_keys; then
        log_info "Vault unsealed successfully using stored keys"
    else
        log_warn "Stored keys not found, switching to manual mode"
        unseal_with_manual_keys
    fi
    
    # Verify unseal
    if vault status -address="$VAULT_ADDR" 2>&1 | grep -q "Sealed.*false"; then
        log_info "Vault is now unsealed and ready"
        vault status -address="$VAULT_ADDR"
    else
        log_error "Failed to unseal Vault"
        exit 1
    fi
}

main "$@"