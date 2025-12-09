#!/bin/bash
# Thaliumx Vault Database Configuration Script
# =============================================
# This script configures dynamic database credentials

set -e

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"

# Database connection details (from environment or defaults)
POSTGRES_HOST="${POSTGRES_HOST:-thaliumx-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-thaliumx}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme}"
POSTGRES_DB="${POSTGRES_DB:-thaliumx}"

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

# Check Vault status
check_vault() {
    if ! vault status -address="$VAULT_ADDR" 2>&1 | grep -q "Sealed.*false"; then
        log_error "Vault is sealed or unavailable"
        exit 1
    fi
    
    if ! vault token lookup -address="$VAULT_ADDR" > /dev/null 2>&1; then
        log_error "Not authenticated to Vault"
        exit 1
    fi
}

# Configure PostgreSQL connection
configure_postgres() {
    log_info "Configuring PostgreSQL connection..."
    
    CONNECTION_URL="postgresql://{{username}}:{{password}}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"
    
    vault write -address="$VAULT_ADDR" database/config/thaliumx-postgres \
        plugin_name="postgresql-database-plugin" \
        allowed_roles="thaliumx-backend,thaliumx-trading,thaliumx-fintech,thaliumx-readonly" \
        connection_url="$CONNECTION_URL" \
        username="$POSTGRES_USER" \
        password="$POSTGRES_PASSWORD" \
        max_open_connections=10 \
        max_idle_connections=5 \
        max_connection_lifetime="5m"
    
    log_info "PostgreSQL connection configured"
}

# Create database roles
create_database_roles() {
    log_info "Creating database roles..."
    
    # Backend role - full access to application tables
    vault write -address="$VAULT_ADDR" database/roles/thaliumx-backend \
        db_name="thaliumx-postgres" \
        creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
            GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
            GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\"; \
            GRANT USAGE ON SCHEMA public TO \"{{name}}\";" \
        revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; \
            REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM \"{{name}}\"; \
            DROP ROLE IF EXISTS \"{{name}}\";" \
        default_ttl="1h" \
        max_ttl="24h"
    
    log_info "Backend database role created"
    
    # Trading role - access to trading-specific tables
    vault write -address="$VAULT_ADDR" database/roles/thaliumx-trading \
        db_name="thaliumx-postgres" \
        creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
            GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
            GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\"; \
            GRANT USAGE ON SCHEMA public TO \"{{name}}\";" \
        revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; \
            REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM \"{{name}}\"; \
            DROP ROLE IF EXISTS \"{{name}}\";" \
        default_ttl="1h" \
        max_ttl="24h"
    
    log_info "Trading database role created"
    
    # Fintech role - access to fintech-specific tables
    vault write -address="$VAULT_ADDR" database/roles/thaliumx-fintech \
        db_name="thaliumx-postgres" \
        creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
            GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
            GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\"; \
            GRANT USAGE ON SCHEMA public TO \"{{name}}\";" \
        revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; \
            REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM \"{{name}}\"; \
            DROP ROLE IF EXISTS \"{{name}}\";" \
        default_ttl="1h" \
        max_ttl="24h"
    
    log_info "Fintech database role created"
    
    # Readonly role - for reporting and analytics
    vault write -address="$VAULT_ADDR" database/roles/thaliumx-readonly \
        db_name="thaliumx-postgres" \
        creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
            GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
            GRANT USAGE ON SCHEMA public TO \"{{name}}\";" \
        revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; \
            DROP ROLE IF EXISTS \"{{name}}\";" \
        default_ttl="1h" \
        max_ttl="8h"
    
    log_info "Readonly database role created"
}

# Rotate root credentials
rotate_root_credentials() {
    log_info "Rotating root database credentials..."
    
    vault write -address="$VAULT_ADDR" -f database/rotate-root/thaliumx-postgres
    
    log_info "Root credentials rotated"
    log_warn "The original database password is no longer valid"
    log_warn "Vault now manages the root database credentials"
}

# Test credential generation
test_credentials() {
    log_info "Testing credential generation..."
    
    log_info "Generating backend credentials..."
    vault read -address="$VAULT_ADDR" database/creds/thaliumx-backend
    
    log_info "Generating trading credentials..."
    vault read -address="$VAULT_ADDR" database/creds/thaliumx-trading
    
    log_info "Generating fintech credentials..."
    vault read -address="$VAULT_ADDR" database/creds/thaliumx-fintech
    
    log_info "Generating readonly credentials..."
    vault read -address="$VAULT_ADDR" database/creds/thaliumx-readonly
}

# Main execution
main() {
    log_info "Starting database configuration..."
    
    check_vault
    configure_postgres
    create_database_roles
    
    echo ""
    read -p "Rotate root database credentials? (y/N): " ROTATE_ROOT
    if [ "$ROTATE_ROOT" = "y" ] || [ "$ROTATE_ROOT" = "Y" ]; then
        rotate_root_credentials
    fi
    
    echo ""
    read -p "Test credential generation? (y/N): " TEST_CREDS
    if [ "$TEST_CREDS" = "y" ] || [ "$TEST_CREDS" = "Y" ]; then
        test_credentials
    fi
    
    log_info "Database configuration complete!"
}

main "$@"