#!/bin/bash
# Thaliumx Vault Production Initialization Script
# ===============================================
# Production-ready Vault initialization with auto-unseal
# Updated: 2025-12-17T04:25:25.000Z - Production mode with auto-unseal
# Notes: Using local auto-unseal for now, migrate to AWS KMS later

set -e

VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}"
INIT_OUTPUT_FILE="/vault/file/init-keys-production.json"
SECRETS_DIR="/vault/file/secrets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Wait for Vault to be ready
wait_for_vault() {
    log_info "Waiting for Vault to be ready..."
    until vault status -address="$VAULT_ADDR" --tls-skip-verify 2>&1 | grep -q "Initialized"; do
        sleep 2
    done
    log_info "Vault is ready"
}

# Initialize Vault with production settings
initialize_vault() {
    log_step "Checking Vault initialization status..."

    if vault status -address="$VAULT_ADDR" --tls-skip-verify 2>&1 | grep -q "Initialized.*true"; then
        log_info "Vault is already initialized"
        return 0
    fi

    log_step "Initializing Vault with 5 key shares and 3 key threshold..."

    mkdir -p "$SECRETS_DIR"

    vault operator init \
        -address="$VAULT_ADDR" \
        --tls-skip-verify \
        -key-shares=5 \
        -key-threshold=3 \
        -format=json > "$INIT_OUTPUT_FILE"

    chmod 600 "$INIT_OUTPUT_FILE"

    log_info "Vault initialized successfully"
    log_warn "IMPORTANT: Securely store the keys from $INIT_OUTPUT_FILE"
    log_warn "These keys are required for recovery operations"

    # Extract and display root token (for initial setup only)
    ROOT_TOKEN=$(jq -r '.root_token' "$INIT_OUTPUT_FILE")
    log_info "Root Token: $ROOT_TOKEN"
    log_warn "Store this root token securely and revoke after initial setup!"
}

# Setup auto-unseal (local transit for now)
setup_auto_unseal() {
    log_step "Setting up auto-unseal..."

    # Login with root token
    ROOT_TOKEN=$(jq -r '.root_token' "$INIT_OUTPUT_FILE")
    export VAULT_TOKEN="$ROOT_TOKEN"

    # Enable transit secrets engine for auto-unseal
    vault secrets enable -address="$VAULT_ADDR" --tls-skip-verify transit 2>/dev/null || log_info "Transit engine already enabled"

    # Create auto-unseal key
    vault write -address="$VAULT_ADDR" --tls-skip-verify \
        transit/keys/autounseal \
        type=rsa-4096 \
        exportable=true || log_info "Auto-unseal key already exists"

    log_info "Auto-unseal configured (local transit)"
    log_warn "TODO: Migrate to AWS KMS for production auto-unseal"
}

# Unseal Vault (should be automatic with auto-unseal, but manual fallback)
unseal_vault() {
    log_step "Checking Vault seal status..."

    if vault status -address="$VAULT_ADDR" --tls-skip-verify 2>&1 | grep -q "Sealed.*false"; then
        log_info "Vault is already unsealed"
        return 0
    fi

    log_info "Vault appears sealed - checking auto-unseal..."

    # Wait a bit for auto-unseal to work
    sleep 5

    if vault status -address="$VAULT_ADDR" --tls-skip-verify 2>&1 | grep -q "Sealed.*false"; then
        log_info "Vault auto-unsealed successfully"
        return 0
    fi

    log_warn "Auto-unseal failed, attempting manual unseal..."

    if [ ! -f "$INIT_OUTPUT_FILE" ]; then
        log_error "Init keys file not found: $INIT_OUTPUT_FILE"
        log_error "Please provide unseal keys manually"
        return 1
    fi

    log_info "Manually unsealing Vault..."

    # Extract unseal keys
    UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' "$INIT_OUTPUT_FILE")
    UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' "$INIT_OUTPUT_FILE")
    UNSEAL_KEY_3=$(jq -r '.unseal_keys_b64[2]' "$INIT_OUTPUT_FILE")

    vault operator unseal -address="$VAULT_ADDR" --tls-skip-verify "$UNSEAL_KEY_1"
    vault operator unseal -address="$VAULT_ADDR" --tls-skip-verify "$UNSEAL_KEY_2"
    vault operator unseal -address="$VAULT_ADDR" --tls-skip-verify "$UNSEAL_KEY_3"

    log_info "Vault unsealed successfully"
}

# Setup secrets engines and policies
setup_secrets_engines() {
    log_step "Setting up secrets engines and policies..."

    ROOT_TOKEN=$(jq -r '.root_token' "$INIT_OUTPUT_FILE")
    export VAULT_TOKEN="$ROOT_TOKEN"

    # Enable KV v2 secrets engines.
    # We support BOTH mount names to avoid drift across older scripts/clients:
    # - `kv/*` (preferred; used by prod-v1 services and policies)
    # - `secret/*` (legacy; used by older seeding scripts)
    vault secrets enable -address="$VAULT_ADDR" --tls-skip-verify -path=kv kv-v2 2>/dev/null || log_info "KV engine already enabled at -path=kv"
    vault secrets enable -address="$VAULT_ADDR" --tls-skip-verify -path=secret kv-v2 2>/dev/null || log_info "KV engine already enabled at -path=secret"

    # Create thaliumx namespace placeholders (both mounts)
    vault kv put -address="$VAULT_ADDR" --tls-skip-verify kv/thaliumx/placeholder value="initialized"
    vault kv put -address="$VAULT_ADDR" --tls-skip-verify secret/thaliumx/placeholder value="initialized"

    # Load policies
    log_info "Loading Vault policies..."
    # Policies may be mounted either under `/vault/config/policies` (legacy)
    # or `/vault/policies` (current repo layout).
    shopt -s nullglob
    for policy_file in /vault/config/policies/*.hcl /vault/policies/*.hcl; do
        if [ -f "$policy_file" ]; then
            policy_name=$(basename "$policy_file" .hcl)
            vault policy write -address="$VAULT_ADDR" --tls-skip-verify "$policy_name" "$policy_file"
            log_info "Loaded policy: $policy_name"
        fi
    done

    # Create admin token role (temporary)
    vault write -address="$VAULT_ADDR" --tls-skip-verify \
        auth/token/roles/admin \
        allowed_policies="admin" \
        orphan=true \
        renewable=true \
        token_explicit_max_ttl="24h"

    log_info "Secrets engines and policies configured"
}

# Setup secret rotation (basic example)
setup_secret_rotation() {
    log_step "Setting up basic secret rotation policies..."

    # Note: Full rotation would require external systems
    log_warn "Basic rotation setup - implement full rotation with external secret managers"
    log_warn "TODO: Integrate with AWS Secrets Manager or similar for automated rotation"
}

# Main execution
main() {
    log_info "Starting Vault production initialization..."

    wait_for_vault
    initialize_vault
    setup_auto_unseal
    unseal_vault
    setup_secrets_engines
    setup_secret_rotation

    log_info "Vault production initialization complete!"
    log_info "Next steps:"
    log_info "  1. Securely backup $INIT_OUTPUT_FILE"
    log_info "  2. Run populate-secrets.sh to load application secrets"
    log_info "  3. Create service tokens using policies"
    log_info "  4. Revoke root token after setup"
}

main "$@"
