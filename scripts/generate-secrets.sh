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

# If set to true, overwrite existing secrets.
FORCE_REGENERATE="${FORCE_REGENERATE:-false}"

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

# Function to generate a JSON secret file
generate_json_secret() {
    local name=$1
    local file="$SECRETS_DIR/$name"

    if [ -f "$file" ] && [ "$FORCE_REGENERATE" != "true" ]; then
        log_warn "Secret $name already exists, skipping (use FORCE_REGENERATE=true to override)"
        return
    fi

    # Minimal JSON map compatible with redis_exporter password-file.
    local redis_pw
    redis_pw="$(openssl rand -base64 32 | tr -d '\n')"
    printf '{"default":"%s"}\n' "$redis_pw" > "$file"
    chmod 600 "$file"
    log_success "Generated secret: $name"
}

# Database passwords
log_info "Generating database passwords..."
generate_secret "postgres-password" 32 password
generate_secret "redis-password" 32 password
generate_secret "mongodb-password" 32 password

# Database usernames
log_info "Generating database usernames..."
generate_secret "postgres-username" 12 alphanumeric

# Application secrets
log_info "Generating application secrets..."
generate_secret "jwt-secret" 64 base64
generate_secret "encryption-key" 32 base64
generate_secret "api-key" 32 hex
generate_secret "jwt-secret-long" 96 base64
generate_secret "encryption-key-long" 64 base64

# Redis exporter expects a JSON file
log_info "Generating Redis exporter secrets..."
generate_json_secret "redis-exporter-passwords.json"


# Vault secrets
log_info "Generating Vault secrets..."
generate_secret "vault-role-id" 16 hex
generate_secret "vault-secret-id" 32 hex

# Grafana secrets
log_info "Generating Grafana secrets..."
generate_secret "grafana-admin-username" 10 alphanumeric
generate_secret "grafana-admin-password" 24 password

# Messaging secrets
log_info "Generating Kafka secrets..."
generate_secret "kafka-password" 24 password
generate_secret "kafka-ui-password" 24 password

# SMTP (required by production config validation)
log_info "Generating SMTP placeholders..."
generate_secret "smtp-user" 12 alphanumeric
generate_secret "smtp-username" 12 alphanumeric
generate_secret "smtp-password" 24 password

# Trading / external exchange secrets (placeholders; override with real creds where needed)
log_info "Generating exchange API placeholders..."
generate_secret "bybit-api-key" 32 alphanumeric
generate_secret "bybit-api-secret" 48 alphanumeric
generate_secret "kucoin-api-key" 32 alphanumeric
generate_secret "kucoin-api-secret" 48 alphanumeric
generate_secret "okx-api-key" 32 alphanumeric
generate_secret "okx-api-secret" 48 alphanumeric
generate_secret "kraken-api-key" 32 alphanumeric
generate_secret "kraken-api-secret" 48 alphanumeric
generate_secret "valr-api-key" 32 alphanumeric
generate_secret "valr-api-secret" 48 alphanumeric
generate_secret "bitstamp-api-key" 32 alphanumeric
generate_secret "bitstamp-api-secret" 48 alphanumeric
generate_secret "crypto-com-api-key" 32 alphanumeric
generate_secret "crypto-com-api-secret" 48 alphanumeric
generate_secret "nedbank-api-key" 32 alphanumeric
generate_secret "nedbank-api-secret" 48 alphanumeric

# Fintech service secrets
log_info "Generating fintech service secrets..."
generate_secret "ballerine-db-username" 12 alphanumeric
generate_secret "ballerine-db-password" 24 password
generate_secret "ballerine-db-url" 48 base64
generate_secret "ballerine-database-url" 48 base64
generate_secret "ballerine-redis-url" 48 base64
generate_secret "ballerine-jwt-secret-key" 64 base64
generate_secret "ballerine-session-secret" 32 base64
generate_secret "ballerine-api-key" 32 hex
generate_secret "ballerine-hashing-key-secret-base64" 64 base64
generate_secret "ballerine-webhook-secret" 32 hex
generate_secret "ballerine-encryption-key" 32 base64
generate_secret "ballerine-workflow-token" 32 hex
generate_secret "ballerine-collection-flow-token" 32 hex
generate_secret "ballerine-magic-link-jwt-secret" 64 base64
generate_secret "ballerine-magic-link-auth-jwt-secret" 64 base64

# Wazuh secrets
log_info "Generating Wazuh secrets..."
generate_secret "wazuh-indexer-username" 10 alphanumeric
generate_secret "wazuh-dashboard-username" 10 alphanumeric
generate_secret "wazuh-indexer-password" 24 password
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
