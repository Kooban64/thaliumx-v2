#!/bin/bash
# ThaliumX Production Setup Script
# =================================
# This script sets up the complete production environment including:
# - TLS certificate generation
# - Secret generation
# - Vault initialization and configuration
# - Secrets population

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DOCKER_DIR")"
SECRETS_DIR="${PROJECT_ROOT}/.secrets"
CERTS_DIR="${DOCKER_DIR}/certs"
ENV_FILE="${DOCKER_DIR}/.env.production"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

log_step() {
    echo -e "${CYAN}>>> $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    local missing=()
    
    command -v docker &> /dev/null || missing+=("docker")
    command -v openssl &> /dev/null || missing+=("openssl")
    command -v jq &> /dev/null || missing+=("jq")
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_info "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    log_info "All prerequisites met"
}

# Generate cryptographic secrets
generate_secrets() {
    log_section "Generating Cryptographic Secrets"
    
    mkdir -p "${SECRETS_DIR}/generated"
    
    # JWT Secret (64 bytes for HS512)
    if [ ! -f "${SECRETS_DIR}/generated/jwt-secret" ]; then
        log_step "Generating JWT secret..."
        openssl rand -base64 64 | tr -d '\n' > "${SECRETS_DIR}/generated/jwt-secret"
        chmod 600 "${SECRETS_DIR}/generated/jwt-secret"
        log_info "JWT secret generated"
    else
        log_info "JWT secret already exists"
    fi
    
    # Encryption Key (32 bytes for AES-256)
    if [ ! -f "${SECRETS_DIR}/generated/encryption-key" ]; then
        log_step "Generating encryption key..."
        openssl rand -base64 32 | tr -d '\n' > "${SECRETS_DIR}/generated/encryption-key"
        chmod 600 "${SECRETS_DIR}/generated/encryption-key"
        log_info "Encryption key generated"
    else
        log_info "Encryption key already exists"
    fi
    
    # Database passwords
    for db in postgres redis mongodb; do
        if [ ! -f "${SECRETS_DIR}/generated/${db}-password" ]; then
            log_step "Generating ${db} password..."
            openssl rand -base64 24 | tr -d '\n' > "${SECRETS_DIR}/generated/${db}-password"
            chmod 600 "${SECRETS_DIR}/generated/${db}-password"
            log_info "${db} password generated"
        else
            log_info "${db} password already exists"
        fi
    done
    
    # Keycloak admin password
    if [ ! -f "${SECRETS_DIR}/generated/keycloak-admin-password" ]; then
        log_step "Generating Keycloak admin password..."
        openssl rand -base64 24 | tr -d '\n' > "${SECRETS_DIR}/generated/keycloak-admin-password"
        chmod 600 "${SECRETS_DIR}/generated/keycloak-admin-password"
        log_info "Keycloak admin password generated"
    else
        log_info "Keycloak admin password already exists"
    fi
    
    # Keycloak client secrets
    for client in backend trading fintech; do
        if [ ! -f "${SECRETS_DIR}/generated/keycloak-${client}-secret" ]; then
            log_step "Generating Keycloak ${client} client secret..."
            openssl rand -hex 32 > "${SECRETS_DIR}/generated/keycloak-${client}-secret"
            chmod 600 "${SECRETS_DIR}/generated/keycloak-${client}-secret"
            log_info "Keycloak ${client} client secret generated"
        else
            log_info "Keycloak ${client} client secret already exists"
        fi
    done
    
    # APISIX admin key
    if [ ! -f "${SECRETS_DIR}/generated/apisix-admin-key" ]; then
        log_step "Generating APISIX admin key..."
        openssl rand -hex 32 > "${SECRETS_DIR}/generated/apisix-admin-key"
        chmod 600 "${SECRETS_DIR}/generated/apisix-admin-key"
        log_info "APISIX admin key generated"
    else
        log_info "APISIX admin key already exists"
    fi
    
    # Kafka SASL password
    if [ ! -f "${SECRETS_DIR}/generated/kafka-password" ]; then
        log_step "Generating Kafka SASL password..."
        openssl rand -base64 24 | tr -d '\n' > "${SECRETS_DIR}/generated/kafka-password"
        chmod 600 "${SECRETS_DIR}/generated/kafka-password"
        log_info "Kafka SASL password generated"
    else
        log_info "Kafka SASL password already exists"
    fi
    
    log_info "All secrets generated successfully"
}

# Generate TLS certificates
generate_certificates() {
    log_section "Generating TLS Certificates"
    
    if [ -f "${CERTS_DIR}/ca/ca.crt" ]; then
        log_info "Certificates already exist. Skipping generation."
        log_info "To regenerate, delete ${CERTS_DIR} and run again."
        return
    fi
    
    # Run the certificate generation script
    chmod +x "${SCRIPT_DIR}/generate-certs.sh"
    "${SCRIPT_DIR}/generate-certs.sh" --environment development --domain thaliumx.local
    
    log_info "TLS certificates generated successfully"
}

# Create Docker network
create_network() {
    log_section "Creating Docker Network"
    
    if docker network inspect thaliumx-net &> /dev/null; then
        log_info "Docker network 'thaliumx-net' already exists"
    else
        docker network create thaliumx-net
        log_info "Docker network 'thaliumx-net' created"
    fi
}

# Start Vault
start_vault() {
    log_section "Starting Vault"
    
    # Check if Vault is already running
    if docker ps --format '{{.Names}}' | grep -q "thaliumx-vault"; then
        log_info "Vault is already running"
        return
    fi
    
    # For initial setup, use non-TLS config (TLS certs need to be generated first)
    cd "${DOCKER_DIR}/vault"
    docker compose up -d
    
    # Wait for Vault to be ready
    log_step "Waiting for Vault to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec thaliumx-vault vault status 2>&1 | grep -q "Initialized"; then
            log_info "Vault is ready"
            break
        fi
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log_error "Vault failed to start within expected time"
        exit 1
    fi
}

# Initialize Vault
initialize_vault() {
    log_section "Initializing Vault"
    
    # Check if already initialized
    if docker exec thaliumx-vault vault status 2>&1 | grep -q "Initialized.*true"; then
        log_info "Vault is already initialized"
        
        # Check if sealed
        if docker exec thaliumx-vault vault status 2>&1 | grep -q "Sealed.*true"; then
            log_warn "Vault is sealed. Attempting to unseal..."
            unseal_vault
        fi
        return
    fi
    
    log_step "Initializing Vault with 5 key shares and 3 key threshold..."
    
    # Initialize Vault
    local init_output
    init_output=$(docker exec thaliumx-vault vault operator init \
        -key-shares=5 \
        -key-threshold=3 \
        -format=json)
    
    # Save initialization output
    echo "$init_output" > "${SECRETS_DIR}/generated/vault-init.json"
    chmod 600 "${SECRETS_DIR}/generated/vault-init.json"
    
    log_info "Vault initialized successfully"
    log_warn "IMPORTANT: Vault initialization keys saved to ${SECRETS_DIR}/generated/vault-init.json"
    log_warn "Store these keys securely! They are required to unseal Vault after restart."
    
    # Unseal Vault
    unseal_vault
}

# Unseal Vault
unseal_vault() {
    log_step "Unsealing Vault..."
    
    if [ ! -f "${SECRETS_DIR}/generated/vault-init.json" ]; then
        log_error "Vault init file not found. Cannot unseal."
        exit 1
    fi
    
    # Extract unseal keys
    local key1 key2 key3
    key1=$(jq -r '.unseal_keys_b64[0]' "${SECRETS_DIR}/generated/vault-init.json")
    key2=$(jq -r '.unseal_keys_b64[1]' "${SECRETS_DIR}/generated/vault-init.json")
    key3=$(jq -r '.unseal_keys_b64[2]' "${SECRETS_DIR}/generated/vault-init.json")
    
    # Unseal
    docker exec thaliumx-vault vault operator unseal "$key1"
    docker exec thaliumx-vault vault operator unseal "$key2"
    docker exec thaliumx-vault vault operator unseal "$key3"
    
    log_info "Vault unsealed successfully"
}

# Configure Vault
configure_vault() {
    log_section "Configuring Vault"
    
    # Get root token
    local root_token
    root_token=$(jq -r '.root_token' "${SECRETS_DIR}/generated/vault-init.json")
    
    # Login to Vault
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault vault login "$root_token"
    
    # Enable audit logging
    log_step "Enabling audit logging..."
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault audit enable file file_path=/vault/logs/audit.log 2>/dev/null || true
    
    # Enable KV secrets engine v2
    log_step "Enabling KV secrets engine v2..."
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault secrets enable -path=kv -version=2 kv 2>/dev/null || true
    
    # Enable Transit secrets engine
    log_step "Enabling Transit secrets engine..."
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault secrets enable transit 2>/dev/null || true
    
    # Enable AppRole auth
    log_step "Enabling AppRole authentication..."
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault auth enable approle 2>/dev/null || true
    
    # Create encryption keys
    log_step "Creating encryption keys..."
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault write -f transit/keys/thaliumx-backend type=aes256-gcm96 2>/dev/null || true
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault write -f transit/keys/thaliumx-trading type=aes256-gcm96 2>/dev/null || true
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault write -f transit/keys/thaliumx-fintech type=aes256-gcm96 2>/dev/null || true
    
    # Write policies
    log_step "Writing Vault policies..."
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault policy write thaliumx-comprehensive /vault/policies/thaliumx-comprehensive.hcl
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault policy write thaliumx-backend /vault/policies/thaliumx-backend.hcl
    
    # Create AppRole for backend
    log_step "Creating AppRole for backend service..."
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault write auth/approle/role/thaliumx-backend \
        token_policies="thaliumx-comprehensive" \
        token_ttl=1h \
        token_max_ttl=4h \
        secret_id_ttl=720h \
        secret_id_num_uses=0
    
    # Get AppRole credentials
    local role_id secret_id
    role_id=$(docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault read -format=json auth/approle/role/thaliumx-backend/role-id | jq -r '.data.role_id')
    secret_id=$(docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault write -format=json -f auth/approle/role/thaliumx-backend/secret-id | jq -r '.data.secret_id')
    
    # Save AppRole credentials
    echo "$role_id" > "${SECRETS_DIR}/generated/vault-role-id"
    echo "$secret_id" > "${SECRETS_DIR}/generated/vault-secret-id"
    chmod 600 "${SECRETS_DIR}/generated/vault-role-id"
    chmod 600 "${SECRETS_DIR}/generated/vault-secret-id"
    
    log_info "Vault configured successfully"
    log_info "AppRole credentials saved to ${SECRETS_DIR}/generated/"
}

# Populate Vault with secrets
populate_vault_secrets() {
    log_section "Populating Vault with Secrets"
    
    local root_token
    root_token=$(jq -r '.root_token' "${SECRETS_DIR}/generated/vault-init.json")
    
    # Database secrets
    log_step "Writing database secrets..."
    local postgres_password redis_password mongodb_password
    postgres_password=$(cat "${SECRETS_DIR}/generated/postgres-password")
    redis_password=$(cat "${SECRETS_DIR}/generated/redis-password")
    mongodb_password=$(cat "${SECRETS_DIR}/generated/mongodb-password")
    
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault kv put kv/thaliumx/database/postgres \
        host=postgres \
        port=5432 \
        database=thaliumx \
        username=thaliumx \
        password="$postgres_password" \
        ssl=true
    
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault kv put kv/thaliumx/cache/redis \
        host=redis \
        port=6379 \
        password="$redis_password" \
        db=0
    
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault kv put kv/thaliumx/database/mongodb \
        host=mongodb \
        port=27017 \
        database=thaliumx \
        username=thaliumx \
        password="$mongodb_password"
    
    # JWT and encryption secrets
    log_step "Writing JWT and encryption secrets..."
    local jwt_secret encryption_key
    jwt_secret=$(cat "${SECRETS_DIR}/generated/jwt-secret")
    encryption_key=$(cat "${SECRETS_DIR}/generated/encryption-key")
    
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault kv put kv/thaliumx/jwt/signing \
        secret="$jwt_secret" \
        issuer=thaliumx \
        audience=thaliumx-users \
        expires_in=15m \
        refresh_expires_in=7d
    
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault kv put kv/thaliumx/encryption/keys \
        key="$encryption_key" \
        algorithm=aes-256-gcm
    
    # Keycloak secrets
    log_step "Writing Keycloak secrets..."
    local keycloak_admin_password keycloak_backend_secret keycloak_trading_secret keycloak_fintech_secret
    keycloak_admin_password=$(cat "${SECRETS_DIR}/generated/keycloak-admin-password")
    keycloak_backend_secret=$(cat "${SECRETS_DIR}/generated/keycloak-backend-secret")
    keycloak_trading_secret=$(cat "${SECRETS_DIR}/generated/keycloak-trading-secret")
    keycloak_fintech_secret=$(cat "${SECRETS_DIR}/generated/keycloak-fintech-secret")
    
    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
        vault kv put kv/thaliumx/oauth/keycloak \
        url=http://keycloak:8080 \
        realm=thaliumx \
        admin_username=admin \
        admin_password="$keycloak_admin_password" \
        client_id=thaliumx-backend \
        client_secret="$keycloak_backend_secret"
    
    # SMTP secrets (from existing .secrets if available)
    log_step "Writing SMTP secrets..."
    if [ -f "${SECRETS_DIR}/smtp.info" ]; then
        local smtp_user smtp_password
        smtp_user=$(grep -E "^user=" "${SECRETS_DIR}/smtp.info" | cut -d'=' -f2 || echo "")
        smtp_password=$(grep -E "^password=" "${SECRETS_DIR}/smtp.info" | cut -d'=' -f2 || echo "")
        
        docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
            vault kv put kv/thaliumx/smtp/config \
            host=smtp.gmail.com \
            port=587 \
            user="$smtp_user" \
            password="$smtp_password" \
            from="$smtp_user" \
            secure=false
    fi
    
    # Exchange credentials (from existing .secrets if available)
    log_step "Writing exchange credentials..."
    if [ -f "${SECRETS_DIR}/exchange-chain.info" ]; then
        # Parse and write exchange credentials
        while IFS= read -r line; do
            if [[ "$line" =~ ^([A-Za-z]+):$ ]]; then
                current_exchange="${BASH_REMATCH[1],,}"
            elif [[ "$line" =~ ^[[:space:]]*api_key:[[:space:]]*(.+)$ ]]; then
                api_key="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^[[:space:]]*api_secret:[[:space:]]*(.+)$ ]]; then
                api_secret="${BASH_REMATCH[1]}"
                if [ -n "$current_exchange" ] && [ -n "$api_key" ]; then
                    docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
                        vault kv put "kv/thaliumx/exchanges/${current_exchange}" \
                        api_key="$api_key" \
                        api_secret="$api_secret" 2>/dev/null || true
                fi
            fi
        done < "${SECRETS_DIR}/exchange-chain.info"
    fi
    
    # Blockchain API keys (from existing .secrets if available)
    log_step "Writing blockchain API keys..."
    if [ -f "${SECRETS_DIR}/chain.info" ]; then
        while IFS='=' read -r key value; do
            if [ -n "$key" ] && [ -n "$value" ]; then
                provider=$(echo "$key" | tr '[:upper:]' '[:lower:]' | sed 's/_api_key//')
                docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
                    vault kv put "kv/thaliumx/blockchain/${provider}" \
                    api_key="$value" 2>/dev/null || true
            fi
        done < "${SECRETS_DIR}/chain.info"
    fi
    
    # Wallet credentials (from existing .secrets if available)
    log_step "Writing wallet credentials..."
    if [ -f "${SECRETS_DIR}/testnet-admin-wallet" ]; then
        local testnet_address testnet_private_key
        testnet_address=$(grep -E "^address=" "${SECRETS_DIR}/testnet-admin-wallet" | cut -d'=' -f2 || echo "")
        testnet_private_key=$(grep -E "^private_key=" "${SECRETS_DIR}/testnet-admin-wallet" | cut -d'=' -f2 || echo "")
        
        if [ -n "$testnet_address" ]; then
            docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
                vault kv put kv/thaliumx/wallets/testnet-admin \
                address="$testnet_address" \
                private_key="$testnet_private_key" \
                network=bsc-testnet \
                chain_id=97
        fi
    fi
    
    if [ -f "${SECRETS_DIR}/admin-wallet-mainnet" ]; then
        local mainnet_address mainnet_private_key
        mainnet_address=$(grep -E "^address=" "${SECRETS_DIR}/admin-wallet-mainnet" | cut -d'=' -f2 || echo "")
        mainnet_private_key=$(grep -E "^private_key=" "${SECRETS_DIR}/admin-wallet-mainnet" | cut -d'=' -f2 || echo "")
        
        if [ -n "$mainnet_address" ]; then
            docker exec -e VAULT_TOKEN="$root_token" thaliumx-vault \
                vault kv put kv/thaliumx/wallets/mainnet-admin \
                address="$mainnet_address" \
                private_key="$mainnet_private_key" \
                network=bsc-mainnet \
                chain_id=56
        fi
    fi
    
    log_info "Vault secrets populated successfully"
}

# Generate production environment file
generate_env_file() {
    log_section "Generating Production Environment File"
    
    local jwt_secret encryption_key postgres_password redis_password keycloak_admin_password
    local vault_role_id vault_secret_id apisix_admin_key
    
    jwt_secret=$(cat "${SECRETS_DIR}/generated/jwt-secret")
    encryption_key=$(cat "${SECRETS_DIR}/generated/encryption-key")
    postgres_password=$(cat "${SECRETS_DIR}/generated/postgres-password")
    redis_password=$(cat "${SECRETS_DIR}/generated/redis-password")
    keycloak_admin_password=$(cat "${SECRETS_DIR}/generated/keycloak-admin-password")
    vault_role_id=$(cat "${SECRETS_DIR}/generated/vault-role-id")
    vault_secret_id=$(cat "${SECRETS_DIR}/generated/vault-secret-id")
    apisix_admin_key=$(cat "${SECRETS_DIR}/generated/apisix-admin-key")
    
    cat > "${ENV_FILE}" << EOF
# ThaliumX Production Environment Configuration
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# WARNING: This file contains sensitive information. Keep it secure!

# Environment
NODE_ENV=production
ENVIRONMENT=production

# Application
PORT=3002
LOG_LEVEL=info

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=thaliumx
DB_USER=thaliumx
DB_PASSWORD=${postgres_password}
DB_SSL=true

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${redis_password}

# JWT (also stored in Vault)
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption (also stored in Vault)
ENCRYPTION_KEY=${encryption_key}
ENCRYPTION_ALGORITHM=aes-256-gcm

# Vault
VAULT_ADDR=http://vault:8200
VAULT_ROLE_ID=${vault_role_id}
VAULT_SECRET_ID=${vault_secret_id}
VAULT_MOUNT_PATH=kv

# Keycloak
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=thaliumx
KEYCLOAK_CLIENT_ID=thaliumx-backend
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=${keycloak_admin_password}

# APISIX
APISIX_ADMIN_KEY=${apisix_admin_key}

# Kafka
KAFKA_BROKERS=kafka:9092
KAFKA_SSL=false

# CORS
CORS_ORIGIN=https://app.thaliumx.com,https://staging.thaliumx.com
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
EOF

    chmod 600 "${ENV_FILE}"
    log_info "Production environment file generated: ${ENV_FILE}"
}

# Print summary
print_summary() {
    log_section "Setup Complete!"
    
    echo -e "${GREEN}✓${NC} Cryptographic secrets generated"
    echo -e "${GREEN}✓${NC} TLS certificates generated"
    echo -e "${GREEN}✓${NC} Docker network created"
    echo -e "${GREEN}✓${NC} Vault started and initialized"
    echo -e "${GREEN}✓${NC} Vault configured with policies and AppRole"
    echo -e "${GREEN}✓${NC} Secrets populated in Vault"
    echo -e "${GREEN}✓${NC} Production environment file generated"
    
    echo ""
    echo -e "${YELLOW}Important Files:${NC}"
    echo "  - Vault init keys: ${SECRETS_DIR}/generated/vault-init.json"
    echo "  - Vault AppRole ID: ${SECRETS_DIR}/generated/vault-role-id"
    echo "  - Vault Secret ID: ${SECRETS_DIR}/generated/vault-secret-id"
    echo "  - Production env: ${ENV_FILE}"
    echo "  - Certificates: ${CERTS_DIR}/"
    
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Review and secure the generated secrets"
    echo "2. Start the remaining services:"
    echo "   cd ${DOCKER_DIR} && docker compose -f databases/compose.yaml up -d"
    echo "3. Start the application:"
    echo "   docker compose -f core/compose.yaml up -d"
    echo ""
    echo -e "${YELLOW}Vault Status:${NC}"
    docker exec thaliumx-vault vault status || true
}

# Main execution
main() {
    log_info "Starting ThaliumX Production Setup..."
    log_info "This will generate secrets, certificates, and configure Vault."
    echo ""
    
    check_prerequisites
    generate_secrets
    generate_certificates
    create_network
    start_vault
    initialize_vault
    configure_vault
    populate_vault_secrets
    generate_env_file
    print_summary
    
    log_info "Setup completed successfully!"
}

# Run main
main "$@"