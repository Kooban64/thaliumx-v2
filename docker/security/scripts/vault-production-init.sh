#!/bin/bash
# ===========================================
# ThaliumX Vault Production Initialization
# ===========================================
# This script initializes Vault for production use
# IMPORTANT: Store the unseal keys and root token securely!

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_ADDR="${VAULT_ADDR:-https://localhost:8200}"
VAULT_KEYS_FILE="${SCRIPT_DIR}/../.vault-keys"
VAULT_CACERT="${SCRIPT_DIR}/../config/vault/tls/ca.crt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== ThaliumX Vault Production Initialization ==="
echo ""
echo "Vault Address: ${VAULT_ADDR}"
echo ""

# Check if Vault is accessible
echo "Checking Vault status..."
if ! vault status -address="${VAULT_ADDR}" -ca-cert="${VAULT_CACERT}" 2>/dev/null; then
    echo -e "${YELLOW}Vault is not initialized or sealed${NC}"
fi

# Check initialization status
INIT_STATUS=$(vault status -address="${VAULT_ADDR}" -ca-cert="${VAULT_CACERT}" -format=json 2>/dev/null | jq -r '.initialized' || echo "false")

if [ "${INIT_STATUS}" == "false" ]; then
    echo ""
    echo -e "${YELLOW}Vault is not initialized. Initializing now...${NC}"
    echo ""
    
    # Initialize Vault with 5 key shares and 3 key threshold
    # For production, consider using PGP keys for encryption
    INIT_OUTPUT=$(vault operator init \
        -address="${VAULT_ADDR}" \
        -ca-cert="${VAULT_CACERT}" \
        -key-shares=5 \
        -key-threshold=3 \
        -format=json)
    
    # Save keys to file (ENCRYPT THIS FILE IN PRODUCTION!)
    echo "${INIT_OUTPUT}" > "${VAULT_KEYS_FILE}"
    chmod 600 "${VAULT_KEYS_FILE}"
    
    echo -e "${GREEN}Vault initialized successfully!${NC}"
    echo ""
    echo -e "${RED}=== CRITICAL: SAVE THESE KEYS SECURELY ===${NC}"
    echo ""
    echo "Unseal Keys:"
    echo "${INIT_OUTPUT}" | jq -r '.unseal_keys_b64[]' | nl
    echo ""
    echo "Root Token:"
    echo "${INIT_OUTPUT}" | jq -r '.root_token'
    echo ""
    echo -e "${RED}WARNING: These keys are stored in ${VAULT_KEYS_FILE}${NC}"
    echo -e "${RED}ENCRYPT or DELETE this file after securing the keys!${NC}"
    echo ""
    
    # Extract keys for unsealing
    UNSEAL_KEY_1=$(echo "${INIT_OUTPUT}" | jq -r '.unseal_keys_b64[0]')
    UNSEAL_KEY_2=$(echo "${INIT_OUTPUT}" | jq -r '.unseal_keys_b64[1]')
    UNSEAL_KEY_3=$(echo "${INIT_OUTPUT}" | jq -r '.unseal_keys_b64[2]')
    ROOT_TOKEN=$(echo "${INIT_OUTPUT}" | jq -r '.root_token')
else
    echo -e "${GREEN}Vault is already initialized${NC}"
    
    # Try to load keys from file
    if [ -f "${VAULT_KEYS_FILE}" ]; then
        UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' "${VAULT_KEYS_FILE}")
        UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' "${VAULT_KEYS_FILE}")
        UNSEAL_KEY_3=$(jq -r '.unseal_keys_b64[2]' "${VAULT_KEYS_FILE}")
        ROOT_TOKEN=$(jq -r '.root_token' "${VAULT_KEYS_FILE}")
    else
        echo -e "${YELLOW}Keys file not found. Manual unseal required.${NC}"
        exit 0
    fi
fi

# Check seal status
SEAL_STATUS=$(vault status -address="${VAULT_ADDR}" -ca-cert="${VAULT_CACERT}" -format=json 2>/dev/null | jq -r '.sealed')

if [ "${SEAL_STATUS}" == "true" ]; then
    echo ""
    echo "Unsealing Vault..."
    
    vault operator unseal -address="${VAULT_ADDR}" -ca-cert="${VAULT_CACERT}" "${UNSEAL_KEY_1}" > /dev/null
    vault operator unseal -address="${VAULT_ADDR}" -ca-cert="${VAULT_CACERT}" "${UNSEAL_KEY_2}" > /dev/null
    vault operator unseal -address="${VAULT_ADDR}" -ca-cert="${VAULT_CACERT}" "${UNSEAL_KEY_3}" > /dev/null
    
    echo -e "${GREEN}Vault unsealed successfully!${NC}"
fi

# Login with root token
export VAULT_TOKEN="${ROOT_TOKEN}"
export VAULT_ADDR="${VAULT_ADDR}"
export VAULT_CACERT="${VAULT_CACERT}"

echo ""
echo "Configuring Vault..."

# Enable audit logging
echo "Enabling audit logging..."
vault audit enable file file_path=/vault/logs/audit.log 2>/dev/null || echo "Audit logging already enabled"

# Enable KV secrets engine
echo "Enabling KV secrets engine..."
vault secrets enable -path=kv kv-v2 2>/dev/null || echo "KV secrets engine already enabled"

# Enable database secrets engine
echo "Enabling database secrets engine..."
vault secrets enable -path=database database 2>/dev/null || echo "Database secrets engine already enabled"

# Enable transit secrets engine (for encryption as a service)
echo "Enabling transit secrets engine..."
vault secrets enable -path=transit transit 2>/dev/null || echo "Transit secrets engine already enabled"

# Create encryption key for application data
echo "Creating encryption keys..."
vault write -f transit/keys/thaliumx-data 2>/dev/null || echo "Encryption key already exists"

# Enable AppRole auth method
echo "Enabling AppRole authentication..."
vault auth enable approle 2>/dev/null || echo "AppRole auth already enabled"

# Create policies
echo "Creating policies..."

# Admin policy
vault policy write admin - << EOF
# Full admin access
path "*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
EOF

# Application policy
vault policy write thaliumx-app - << EOF
# Read secrets
path "kv/data/fintech/*" {
  capabilities = ["read", "list"]
}

path "kv/data/trading/*" {
  capabilities = ["read", "list"]
}

# Use transit encryption
path "transit/encrypt/thaliumx-data" {
  capabilities = ["update"]
}

path "transit/decrypt/thaliumx-data" {
  capabilities = ["update"]
}

# Database credentials
path "database/creds/thaliumx-*" {
  capabilities = ["read"]
}
EOF

# Create AppRole for applications
echo "Creating AppRole for applications..."
vault write auth/approle/role/thaliumx-app \
    token_policies="thaliumx-app" \
    token_ttl=1h \
    token_max_ttl=4h \
    secret_id_ttl=24h \
    secret_id_num_uses=0

# Get AppRole credentials
ROLE_ID=$(vault read -format=json auth/approle/role/thaliumx-app/role-id | jq -r '.data.role_id')
SECRET_ID=$(vault write -format=json -f auth/approle/role/thaliumx-app/secret-id | jq -r '.data.secret_id')

echo ""
echo -e "${GREEN}=== Vault Configuration Complete ===${NC}"
echo ""
echo "AppRole Credentials (for application configuration):"
echo "  Role ID:   ${ROLE_ID}"
echo "  Secret ID: ${SECRET_ID}"
echo ""
echo "Store these credentials securely for application use."
echo ""

# Create initial secrets
echo "Creating initial secrets..."

vault kv put kv/fintech/ballerine \
    db_password="${BALLERINE_DB_PASSWORD:-dW2QSkQnxJhaY2pP8mAt7YR9qtmbaHZ7}" \
    session_secret="$(openssl rand -hex 32)" \
    api_key="$(openssl rand -hex 32)" \
    hashing_key_secret="$(openssl rand -base64 32)" \
    webhook_secret="$(openssl rand -hex 32)" \
    jwt_secret_key="$(openssl rand -hex 64)" \
    magic_link_jwt_secret="$(openssl rand -hex 64)" \
    magic_link_auth_jwt_secret="$(openssl rand -hex 64)"

vault kv put kv/fintech/backend \
    DATABASE_URL="postgresql://thaliumx:${POSTGRES_PASSWORD:-dW2QSkQnxJhaY2pP8mAt7YR9qtmbaHZ7}@thaliumx-postgres:5432/thaliumx" \
    REDIS_URL="redis://:${REDIS_PASSWORD:-NFqT8uZlru7Tw5cv8IHVll23BNHg2otS}@thaliumx-redis:6379" \
    JWT_SECRET="$(openssl rand -hex 64)" \
    ENCRYPTION_KEY="$(openssl rand -hex 32)"

vault kv put kv/trading/dingir \
    db_password="${POSTGRES_PASSWORD:-dW2QSkQnxJhaY2pP8mAt7YR9qtmbaHZ7}" \
    kafka_password="${KAFKA_SASL_PASSWORD:-ThaliumX2025kafka}"

echo ""
echo -e "${GREEN}Initial secrets created successfully!${NC}"
echo ""
echo "=== Vault Production Setup Complete ==="