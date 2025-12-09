#!/bin/bash
# Thaliumx Vault Secrets Setup Script
# ====================================
# This script configures secrets engines, policies, and auth methods

set -e

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
POLICIES_DIR="/vault/policies"

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

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Check if Vault is unsealed and we're authenticated
check_vault_status() {
    log_info "Checking Vault status..."
    
    if ! vault status -address="$VAULT_ADDR" 2>&1 | grep -q "Sealed.*false"; then
        log_error "Vault is sealed. Please unseal first."
        exit 1
    fi
    
    if ! vault token lookup -address="$VAULT_ADDR" > /dev/null 2>&1; then
        log_error "Not authenticated to Vault. Please login first."
        exit 1
    fi
    
    log_info "Vault is ready"
}

# Enable audit logging
setup_audit() {
    log_section "Setting up Audit Logging"
    
    # File audit device
    if ! vault audit list -address="$VAULT_ADDR" | grep -q "file/"; then
        vault audit enable -address="$VAULT_ADDR" file file_path=/vault/logs/audit.log
        log_info "File audit device enabled"
    else
        log_info "File audit device already enabled"
    fi
}

# Enable and configure KV secrets engine v2
setup_kv_engine() {
    log_section "Setting up KV Secrets Engine v2"
    
    if ! vault secrets list -address="$VAULT_ADDR" | grep -q "^kv/"; then
        vault secrets enable -address="$VAULT_ADDR" -path=kv -version=2 kv
        log_info "KV secrets engine v2 enabled at kv/"
    else
        log_info "KV secrets engine already enabled"
    fi
    
    # Create initial secret structure
    log_info "Creating initial secret structure..."
    
    # Shared secrets
    vault kv put -address="$VAULT_ADDR" kv/thaliumx/shared/config \
        environment="development" \
        log_level="info"
    
    # Backend secrets placeholder
    vault kv put -address="$VAULT_ADDR" kv/thaliumx/backend/config \
        app_name="thaliumx-backend" \
        debug="false"
    
    # Trading secrets placeholder
    vault kv put -address="$VAULT_ADDR" kv/thaliumx/trading/config \
        app_name="thaliumx-trading" \
        max_orders_per_second="1000"
    
    # Fintech secrets placeholder
    vault kv put -address="$VAULT_ADDR" kv/thaliumx/fintech/config \
        app_name="thaliumx-fintech" \
        kyc_enabled="true"
    
    log_info "Initial secrets created"
}

# Enable and configure Transit secrets engine
setup_transit_engine() {
    log_section "Setting up Transit Secrets Engine"
    
    if ! vault secrets list -address="$VAULT_ADDR" | grep -q "^transit/"; then
        vault secrets enable -address="$VAULT_ADDR" transit
        log_info "Transit secrets engine enabled"
    else
        log_info "Transit secrets engine already enabled"
    fi
    
    # Create encryption keys for each service
    log_info "Creating encryption keys..."
    
    # Backend encryption key
    vault write -address="$VAULT_ADDR" -f transit/keys/thaliumx-backend \
        type="aes256-gcm96" \
        exportable="false" \
        allow_plaintext_backup="false"
    
    # Trading encryption key (for order data)
    vault write -address="$VAULT_ADDR" -f transit/keys/thaliumx-trading \
        type="aes256-gcm96" \
        exportable="false" \
        allow_plaintext_backup="false"
    
    # Fintech encryption key (for PII data)
    vault write -address="$VAULT_ADDR" -f transit/keys/thaliumx-fintech \
        type="aes256-gcm96" \
        exportable="false" \
        allow_plaintext_backup="false"
    
    log_info "Encryption keys created"
}

# Enable and configure Database secrets engine
setup_database_engine() {
    log_section "Setting up Database Secrets Engine"
    
    if ! vault secrets list -address="$VAULT_ADDR" | grep -q "^database/"; then
        vault secrets enable -address="$VAULT_ADDR" database
        log_info "Database secrets engine enabled"
    else
        log_info "Database secrets engine already enabled"
    fi
    
    log_info "Database secrets engine ready"
    log_warn "Configure database connections after PostgreSQL is running"
    log_warn "Use: vault write database/config/thaliumx-postgres ..."
}

# Configure policies
setup_policies() {
    log_section "Setting up Policies"
    
    # Admin policy
    if [ -f "$POLICIES_DIR/admin.hcl" ]; then
        vault policy write -address="$VAULT_ADDR" admin "$POLICIES_DIR/admin.hcl"
        log_info "Admin policy created"
    fi
    
    # Backend policy
    if [ -f "$POLICIES_DIR/thaliumx-backend.hcl" ]; then
        vault policy write -address="$VAULT_ADDR" thaliumx-backend "$POLICIES_DIR/thaliumx-backend.hcl"
        log_info "Backend policy created"
    fi
    
    # Trading policy
    if [ -f "$POLICIES_DIR/thaliumx-trading.hcl" ]; then
        vault policy write -address="$VAULT_ADDR" thaliumx-trading "$POLICIES_DIR/thaliumx-trading.hcl"
        log_info "Trading policy created"
    fi
    
    # Fintech policy
    if [ -f "$POLICIES_DIR/thaliumx-fintech.hcl" ]; then
        vault policy write -address="$VAULT_ADDR" thaliumx-fintech "$POLICIES_DIR/thaliumx-fintech.hcl"
        log_info "Fintech policy created"
    fi
    
    log_info "All policies configured"
}

# Enable and configure AppRole auth method
setup_approle_auth() {
    log_section "Setting up AppRole Authentication"
    
    if ! vault auth list -address="$VAULT_ADDR" | grep -q "^approle/"; then
        vault auth enable -address="$VAULT_ADDR" approle
        log_info "AppRole auth method enabled"
    else
        log_info "AppRole auth method already enabled"
    fi
    
    # Create AppRole for backend
    vault write -address="$VAULT_ADDR" auth/approle/role/thaliumx-backend \
        token_policies="thaliumx-backend" \
        token_ttl="1h" \
        token_max_ttl="4h" \
        secret_id_ttl="720h" \
        secret_id_num_uses="0"
    log_info "Backend AppRole created"
    
    # Create AppRole for trading
    vault write -address="$VAULT_ADDR" auth/approle/role/thaliumx-trading \
        token_policies="thaliumx-trading" \
        token_ttl="1h" \
        token_max_ttl="4h" \
        secret_id_ttl="720h" \
        secret_id_num_uses="0"
    log_info "Trading AppRole created"
    
    # Create AppRole for fintech
    vault write -address="$VAULT_ADDR" auth/approle/role/thaliumx-fintech \
        token_policies="thaliumx-fintech" \
        token_ttl="1h" \
        token_max_ttl="4h" \
        secret_id_ttl="720h" \
        secret_id_num_uses="0"
    log_info "Fintech AppRole created"
    
    log_info "AppRole authentication configured"
}

# Enable and configure Kubernetes auth (for future K8s deployment)
setup_kubernetes_auth() {
    log_section "Setting up Kubernetes Authentication (Placeholder)"
    
    log_info "Kubernetes auth will be configured when deploying to K8s"
    log_info "Use: vault auth enable kubernetes"
}

# Generate service credentials
generate_service_credentials() {
    log_section "Generating Service Credentials"
    
    CREDS_FILE="/vault/data/secrets/service-credentials.json"
    mkdir -p /vault/data/secrets
    
    echo "{" > "$CREDS_FILE"
    
    # Backend credentials
    BACKEND_ROLE_ID=$(vault read -address="$VAULT_ADDR" -format=json auth/approle/role/thaliumx-backend/role-id | jq -r '.data.role_id')
    BACKEND_SECRET_ID=$(vault write -address="$VAULT_ADDR" -format=json -f auth/approle/role/thaliumx-backend/secret-id | jq -r '.data.secret_id')
    
    echo "  \"backend\": {" >> "$CREDS_FILE"
    echo "    \"role_id\": \"$BACKEND_ROLE_ID\"," >> "$CREDS_FILE"
    echo "    \"secret_id\": \"$BACKEND_SECRET_ID\"" >> "$CREDS_FILE"
    echo "  }," >> "$CREDS_FILE"
    
    # Trading credentials
    TRADING_ROLE_ID=$(vault read -address="$VAULT_ADDR" -format=json auth/approle/role/thaliumx-trading/role-id | jq -r '.data.role_id')
    TRADING_SECRET_ID=$(vault write -address="$VAULT_ADDR" -format=json -f auth/approle/role/thaliumx-trading/secret-id | jq -r '.data.secret_id')
    
    echo "  \"trading\": {" >> "$CREDS_FILE"
    echo "    \"role_id\": \"$TRADING_ROLE_ID\"," >> "$CREDS_FILE"
    echo "    \"secret_id\": \"$TRADING_SECRET_ID\"" >> "$CREDS_FILE"
    echo "  }," >> "$CREDS_FILE"
    
    # Fintech credentials
    FINTECH_ROLE_ID=$(vault read -address="$VAULT_ADDR" -format=json auth/approle/role/thaliumx-fintech/role-id | jq -r '.data.role_id')
    FINTECH_SECRET_ID=$(vault write -address="$VAULT_ADDR" -format=json -f auth/approle/role/thaliumx-fintech/secret-id | jq -r '.data.secret_id')
    
    echo "  \"fintech\": {" >> "$CREDS_FILE"
    echo "    \"role_id\": \"$FINTECH_ROLE_ID\"," >> "$CREDS_FILE"
    echo "    \"secret_id\": \"$FINTECH_SECRET_ID\"" >> "$CREDS_FILE"
    echo "  }" >> "$CREDS_FILE"
    
    echo "}" >> "$CREDS_FILE"
    
    chmod 600 "$CREDS_FILE"
    
    log_info "Service credentials saved to $CREDS_FILE"
    log_warn "Distribute these credentials securely to each service"
}

# Print summary
print_summary() {
    log_section "Setup Complete!"
    
    echo "Secrets Engines:"
    vault secrets list -address="$VAULT_ADDR"
    
    echo ""
    echo "Auth Methods:"
    vault auth list -address="$VAULT_ADDR"
    
    echo ""
    echo "Policies:"
    vault policy list -address="$VAULT_ADDR"
    
    log_info ""
    log_info "Next steps:"
    log_info "1. Configure database connections when PostgreSQL is running"
    log_info "2. Add actual secrets to kv/thaliumx/* paths"
    log_info "3. Distribute AppRole credentials to services"
    log_info "4. Revoke root token after creating admin users"
}

# Main execution
main() {
    log_info "Starting Vault secrets setup..."
    
    check_vault_status
    setup_audit
    setup_kv_engine
    setup_transit_engine
    setup_database_engine
    setup_policies
    setup_approle_auth
    generate_service_credentials
    print_summary
    
    log_info "Vault setup complete!"
}

main "$@"