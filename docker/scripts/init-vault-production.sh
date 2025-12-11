#!/bin/bash
# ===========================================
# ThaliumX Vault Production Initialization
# ===========================================
# Initializes Vault with persistent file storage
# Stores unseal keys and root token securely

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_ADDR="${VAULT_ADDR:-http://thaliumx-vault:8200}"
VAULT_KEYS_DIR="${SCRIPT_DIR}/../security/.vault-keys"
VAULT_KEYS_FILE="${VAULT_KEYS_DIR}/vault-keys.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=== ThaliumX Vault Production Initialization ===${NC}"
echo ""
echo "Vault Address: ${VAULT_ADDR}"
echo ""

# Create keys directory
mkdir -p "${VAULT_KEYS_DIR}"
chmod 700 "${VAULT_KEYS_DIR}"

# Wait for Vault to be ready
echo "Waiting for Vault to be ready..."
for i in {1..30}; do
    if docker exec thaliumx-vault vault status -address="${VAULT_ADDR}" 2>/dev/null | grep -q "Initialized"; then
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

# Check initialization status
echo ""
echo "Checking Vault status..."
INIT_STATUS=$(docker exec thaliumx-vault vault status -address="${VAULT_ADDR}" -format=json 2>/dev/null | jq -r '.initialized' || echo "false")
SEAL_STATUS=$(docker exec thaliumx-vault vault status -address="${VAULT_ADDR}" -format=json 2>/dev/null | jq -r '.sealed' || echo "true")

echo "  Initialized: ${INIT_STATUS}"
echo "  Sealed: ${SEAL_STATUS}"

if [ "${INIT_STATUS}" == "false" ]; then
    echo ""
    echo -e "${YELLOW}Vault is not initialized. Initializing now...${NC}"
    echo ""
    
    # Initialize Vault with 5 key shares and 3 key threshold
    INIT_OUTPUT=$(docker exec thaliumx-vault vault operator init \
        -address="${VAULT_ADDR}" \
        -key-shares=5 \
        -key-threshold=3 \
        -format=json)
    
    # Save keys to file
    echo "${INIT_OUTPUT}" > "${VAULT_KEYS_FILE}"
    chmod 600 "${VAULT_KEYS_FILE}"
    
    echo -e "${GREEN}Vault initialized successfully!${NC}"
    echo ""
    echo -e "${RED}=== CRITICAL: SAVE THESE KEYS SECURELY ===${NC}"
    echo ""
    echo "Unseal Keys (need 3 of 5 to unseal):"
    echo "${INIT_OUTPUT}" | jq -r '.unseal_keys_b64[]' | nl
    echo ""
    echo "Root Token:"
    echo "${INIT_OUTPUT}" | jq -r '.root_token'
    echo ""
    echo -e "${YELLOW}Keys saved to: ${VAULT_KEYS_FILE}${NC}"
    echo -e "${RED}IMPORTANT: Backup this file securely and delete after securing keys!${NC}"
    
    # Extract keys for unsealing
    UNSEAL_KEY_1=$(echo "${INIT_OUTPUT}" | jq -r '.unseal_keys_b64[0]')
    UNSEAL_KEY_2=$(echo "${INIT_OUTPUT}" | jq -r '.unseal_keys_b64[1]')
    UNSEAL_KEY_3=$(echo "${INIT_OUTPUT}" | jq -r '.unseal_keys_b64[2]')
    ROOT_TOKEN=$(echo "${INIT_OUTPUT}" | jq -r '.root_token')
    
    # Update seal status
    SEAL_STATUS="true"
else
    echo -e "${GREEN}Vault is already initialized${NC}"
    
    # Try to load keys from file
    if [ -f "${VAULT_KEYS_FILE}" ]; then
        echo "Loading keys from ${VAULT_KEYS_FILE}..."
        UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' "${VAULT_KEYS_FILE}")
        UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' "${VAULT_KEYS_FILE}")
        UNSEAL_KEY_3=$(jq -r '.unseal_keys_b64[2]' "${VAULT_KEYS_FILE}")
        ROOT_TOKEN=$(jq -r '.root_token' "${VAULT_KEYS_FILE}")
    else
        echo -e "${YELLOW}Keys file not found. Manual unseal required.${NC}"
        echo "Please provide unseal keys manually."
        exit 0
    fi
fi

# Unseal Vault if sealed
if [ "${SEAL_STATUS}" == "true" ]; then
    echo ""
    echo "Unsealing Vault..."
    
    docker exec thaliumx-vault vault operator unseal -address="${VAULT_ADDR}" "${UNSEAL_KEY_1}" > /dev/null 2>&1
    docker exec thaliumx-vault vault operator unseal -address="${VAULT_ADDR}" "${UNSEAL_KEY_2}" > /dev/null 2>&1
    docker exec thaliumx-vault vault operator unseal -address="${VAULT_ADDR}" "${UNSEAL_KEY_3}" > /dev/null 2>&1
    
    echo -e "${GREEN}Vault unsealed successfully!${NC}"
fi

# Configure Vault
echo ""
echo "Configuring Vault..."

# Login with root token
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault login -address="${VAULT_ADDR}" "${ROOT_TOKEN}" > /dev/null 2>&1

# Enable audit logging
echo "  Enabling audit logging..."
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault audit enable -address="${VAULT_ADDR}" file file_path=/vault/logs/audit.log 2>/dev/null || echo "    (already enabled)"

# Enable KV secrets engine
echo "  Enabling KV secrets engine..."
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault secrets enable -address="${VAULT_ADDR}" -path=kv kv-v2 2>/dev/null || echo "    (already enabled)"

# Enable transit secrets engine
echo "  Enabling transit secrets engine..."
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault secrets enable -address="${VAULT_ADDR}" -path=transit transit 2>/dev/null || echo "    (already enabled)"

# Create encryption key
echo "  Creating encryption keys..."
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault write -address="${VAULT_ADDR}" -f transit/keys/thaliumx-data 2>/dev/null || echo "    (already exists)"

# Enable AppRole auth
echo "  Enabling AppRole authentication..."
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault auth enable -address="${VAULT_ADDR}" approle 2>/dev/null || echo "    (already enabled)"

# Create application policy
echo "  Creating application policies..."
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault policy write -address="${VAULT_ADDR}" thaliumx-app - << 'EOF'
# ThaliumX Application Policy
path "kv/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "transit/encrypt/thaliumx-data" {
  capabilities = ["update"]
}

path "transit/decrypt/thaliumx-data" {
  capabilities = ["update"]
}
EOF

# Create AppRole
echo "  Creating AppRole for applications..."
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault write -address="${VAULT_ADDR}" auth/approle/role/thaliumx-app \
    token_policies="thaliumx-app" \
    token_ttl=1h \
    token_max_ttl=4h \
    secret_id_ttl=0 \
    secret_id_num_uses=0 2>/dev/null

# Get AppRole credentials
ROLE_ID=$(docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault read -address="${VAULT_ADDR}" -format=json auth/approle/role/thaliumx-app/role-id 2>/dev/null | jq -r '.data.role_id')
SECRET_ID=$(docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault write -address="${VAULT_ADDR}" -format=json -f auth/approle/role/thaliumx-app/secret-id 2>/dev/null | jq -r '.data.secret_id')

# Store initial secrets
echo "  Storing initial secrets..."
docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault kv put -address="${VAULT_ADDR}" kv/thaliumx/database \
    postgres_password="PLACEHOLDER_POSTGRES_PASSWORD" \
    redis_password="PLACEHOLDER_REDIS_PASSWORD" \
    mongodb_password="PLACEHOLDER_MONGODB_PASSWORD" 2>/dev/null || echo "    (already exists)"

docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault kv put -address="${VAULT_ADDR}" kv/thaliumx/api \
    jwt_secret="PLACEHOLDER_JWT_SECRET" \
    encryption_key="PLACEHOLDER_ENCRYPTION_KEY" \
    ballerine_api_key="PLACEHOLDER_BALLERINE_API_KEY" \
    ballerine_webhook_secret="PLACEHOLDER_BALLERINE_WEBHOOK_SECRET" 2>/dev/null || echo "    (already exists)"

docker exec -e VAULT_TOKEN="${ROOT_TOKEN}" thaliumx-vault vault kv put -address="${VAULT_ADDR}" kv/thaliumx/external \
    stripe_secret_key="PLACEHOLDER_STRIPE_SECRET_KEY" \
    sendgrid_api_key="PLACEHOLDER_SENDGRID_API_KEY" \
    twilio_account_sid="PLACEHOLDER_TWILIO_SID" \
    twilio_auth_token="PLACEHOLDER_TWILIO_TOKEN" \
    infura_api_key="PLACEHOLDER_INFURA_KEY" 2>/dev/null || echo "    (already exists)"

# Save AppRole credentials
echo ""
echo -e "${GREEN}=== Vault Configuration Complete ===${NC}"
echo ""
echo "AppRole Credentials:"
echo "  Role ID:   ${ROLE_ID}"
echo "  Secret ID: ${SECRET_ID}"
echo ""

# Save credentials to file
cat > "${VAULT_KEYS_DIR}/approle-credentials.json" << EOF
{
  "role_id": "${ROLE_ID}",
  "secret_id": "${SECRET_ID}",
  "vault_addr": "${VAULT_ADDR}"
}
EOF
chmod 600 "${VAULT_KEYS_DIR}/approle-credentials.json"

echo "AppRole credentials saved to: ${VAULT_KEYS_DIR}/approle-credentials.json"
echo ""
echo -e "${YELLOW}IMPORTANT: Update placeholder secrets in Vault with real values:${NC}"
echo "  vault kv put kv/thaliumx/database postgres_password=<real_password> ..."
echo "  vault kv put kv/thaliumx/api jwt_secret=<real_secret> ..."
echo "  vault kv put kv/thaliumx/external stripe_secret_key=<real_key> ..."
echo ""
echo -e "${GREEN}=== Vault Production Setup Complete ===${NC}"