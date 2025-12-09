#!/bin/bash
# ThaliumX Secrets Generation Script
# Generates all required secrets for production deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SECRETS_DIR="$PROJECT_ROOT/.secrets/generated"

log_info "Starting secrets generation..."
log_info "Secrets will be stored in: $SECRETS_DIR"

# Create secrets directory
mkdir -p "$SECRETS_DIR"

# Function to generate a secret
generate_secret() {
    local name=$1
    local length=${2:-32}
    local type=${3:-base64}
    local file="$SECRETS_DIR/$name"
    
    if [ -f "$file" ] && [ "$FORCE_REGENERATE" != "true" ]; then
        log_warn "Secret $name already exists, skipping (use FORCE_REGENERATE=true to override)"
        return
    fi
    
    case $type in
        base64)
            openssl rand -base64 $length | tr -d '\n' > "$file"
            ;;
        hex)
            openssl rand -hex $length > "$file"
            ;;
        alphanumeric)
            openssl rand -base64 $((length * 2)) | tr -dc 'a-zA-Z0-9' | head -c $length > "$file"
            ;;
        password)
            # Generate a strong password with special characters
            openssl rand -base64 $((length * 2)) | tr -dc 'a-zA-Z0-9!@#$%^&*()_+-=' | head -c $length > "$file"
            ;;
    esac
    
    chmod 600 "$file"
    log_success "Generated secret: $name"
}

# Database passwords
log_info "Generating database passwords..."
generate_secret "postgres-password" 32 password
generate_secret "redis-password" 32 password
generate_secret "mongodb-password" 32 password

# Application secrets
log_info "Generating application secrets..."
generate_secret "jwt-secret" 64 base64
generate_secret "encryption-key" 32 base64
generate_secret "session-secret" 32 base64

# Keycloak secrets
log_info "Generating Keycloak secrets..."
generate_secret "keycloak-admin-password" 24 password
generate_secret "keycloak-client-secret" 32 hex

# Vault secrets
log_info "Generating Vault secrets..."
generate_secret "vault-role-id" 16 hex
generate_secret "vault-secret-id" 32 hex

# Grafana secrets
log_info "Generating Grafana secrets..."
generate_secret "grafana-admin-password" 24 password

# APISIX secrets
log_info "Generating APISIX secrets..."
generate_secret "apisix-admin-key" 32 hex

# Trading service secrets
log_info "Generating trading service secrets..."
generate_secret "dingir-api-key" 32 hex
generate_secret "trading-encryption-key" 32 base64

# Fintech service secrets
log_info "Generating fintech service secrets..."
generate_secret "ballerine-session-secret" 32 base64
generate_secret "ballerine-api-key" 32 hex
generate_secret "ballerine-jwt-secret" 64 base64
generate_secret "ballerine-webhook-secret" 32 hex
generate_secret "ballerine-encryption-key" 32 base64

# Wazuh secrets
log_info "Generating Wazuh secrets..."
generate_secret "wazuh-indexer-password" 24 password
generate_secret "wazuh-api-password" 24 password
generate_secret "wazuh-dashboard-password" 24 password

# Typesense secrets
log_info "Generating Typesense secrets..."
generate_secret "typesense-api-key" 32 alphanumeric

log_success "All secrets generated successfully!"
echo ""
echo "Generated secrets:"
ls -la "$SECRETS_DIR"
echo ""
log_warn "IMPORTANT: Back up these secrets securely. They cannot be recovered if lost."