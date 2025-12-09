#!/bin/bash
# Thaliumx Vault Initialization Script
# =====================================
# This script initializes Vault and sets up the initial configuration

set -e

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
INIT_OUTPUT_FILE="/vault/file/init-keys.json"
SECRETS_DIR="/vault/file/secrets"

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

# Wait for Vault to be ready
wait_for_vault() {
    log_info "Waiting for Vault to be ready..."
    until vault status -address="$VAULT_ADDR" 2>&1 | grep -q "Initialized"; do
        sleep 1
    done
    log_info "Vault is ready"
}

# Initialize Vault
initialize_vault() {
    log_info "Checking Vault initialization status..."
    
    if vault status -address="$VAULT_ADDR" 2>&1 | grep -q "Initialized.*true"; then
        log_info "Vault is already initialized"
        return 0
    fi
    
    log_info "Initializing Vault with 5 key shares and 3 key threshold..."
    
    mkdir -p "$SECRETS_DIR"
    
    vault operator init \
        -address="$VAULT_ADDR" \
        -key-shares=5 \
        -key-threshold=3 \
        -format=json > "$INIT_OUTPUT_FILE"
    
    chmod 600 "$INIT_OUTPUT_FILE"
    
    log_info "Vault initialized successfully"
    log_warn "IMPORTANT: Securely store the keys from $INIT_OUTPUT_FILE"
    log_warn "These keys are required to unseal Vault after a restart"
    
    # Extract and display root token (for initial setup only)
    ROOT_TOKEN=$(jq -r '.root_token' "$INIT_OUTPUT_FILE")
    log_info "Root Token: $ROOT_TOKEN"
    log_warn "Store this root token securely and revoke after initial setup!"
}

# Unseal Vault
unseal_vault() {
    log_info "Checking Vault seal status..."
    
    if vault status -address="$VAULT_ADDR" 2>&1 | grep -q "Sealed.*false"; then
        log_info "Vault is already unsealed"
        return 0
    fi
    
    if [ ! -f "$INIT_OUTPUT_FILE" ]; then
        log_error "Init keys file not found: $INIT_OUTPUT_FILE"
        log_error "Please provide unseal keys manually"
        return 1
    fi
    
    log_info "Unsealing Vault..."
    
    # Extract unseal keys
    UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' "$INIT_OUTPUT_FILE")
    UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' "$INIT_OUTPUT_FILE")
    UNSEAL_KEY_3=$(jq -r '.unseal_keys_b64[2]' "$INIT_OUTPUT_FILE")
    
    vault operator unseal -address="$VAULT_ADDR" "$UNSEAL_KEY_1"
    vault operator unseal -address="$VAULT_ADDR" "$UNSEAL_KEY_2"
    vault operator unseal -address="$VAULT_ADDR" "$UNSEAL_KEY_3"
    
    log_info "Vault unsealed successfully"
}

# Login with root token
login_vault() {
    if [ ! -f "$INIT_OUTPUT_FILE" ]; then
        log_error "Init keys file not found"
        return 1
    fi
    
    ROOT_TOKEN=$(jq -r '.root_token' "$INIT_OUTPUT_FILE")
    vault login -address="$VAULT_ADDR" "$ROOT_TOKEN"
    log_info "Logged in to Vault"
}

# Main execution
main() {
    log_info "Starting Vault initialization..."
    
    wait_for_vault
    initialize_vault
    unseal_vault
    login_vault
    
    log_info "Vault initialization complete!"
    log_info "Run setup-secrets.sh to configure secrets engines and policies"
}

main "$@"