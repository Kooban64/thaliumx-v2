#!/bin/bash
# Thaliumx Keycloak Secrets Population Script
# ===========================================
# Loads Keycloak-specific secrets into Vault
# Updated: 2025-12-17T12:25:30.000Z

set -e

VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}"

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

# Function to load secret into Vault
load_secret() {
    local secret_path=$1
    local secret_key=$2
    local secret_file=$3

    if [ ! -f "$secret_file" ]; then
        log_error "Secret file not found: $secret_file"
        return 1
    fi

    local secret_value=$(cat "$secret_file" | tr -d '\n')

    log_info "Loading secret: $secret_path -> $secret_key"
    vault kv put -address="$VAULT_ADDR" --tls-skip-verify "$secret_path" "$secret_key"="$secret_value"

    if [ $? -eq 0 ]; then
        log_info "✅ Successfully loaded: $secret_key"
    else
        log_error "❌ Failed to load: $secret_key"
        return 1
    fi
}

# Main execution
main() {
    log_info "🔐 Populating Keycloak secrets into Vault..."

    # Load Keycloak admin credentials
    load_secret "secret/thaliumx/keycloak/admin" "username" ".secrets/generated/keycloak-admin-username"
    load_secret "secret/thaliumx/keycloak/admin" "password" ".secrets/generated/keycloak-admin-password"

    # Load database credentials for Keycloak
    load_secret "secret/thaliumx/keycloak/database" "username" ".secrets/generated/postgres-username"
    load_secret "secret/thaliumx/keycloak/database" "password" ".secrets/generated/postgres-password"

    # Load JWT secrets for Keycloak
    load_secret "secret/thaliumx/keycloak/jwt" "secret" ".secrets/generated/jwt-secret"

    # Load encryption key for Keycloak
    load_secret "secret/thaliumx/keycloak/encryption" "key" ".secrets/generated/encryption-key"

    log_info "✅ All Keycloak secrets loaded successfully!"
    log_info "🔍 Verify secrets:"
    vault kv list -address="$VAULT_ADDR" --tls-skip-verify secret/thaliumx/keycloak/
}

main "$@"