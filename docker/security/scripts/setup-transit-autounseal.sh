#!/bin/bash
# ===========================================
# ThaliumX Vault Transit Auto-Unseal Setup
# ===========================================
# This script sets up Transit auto-unseal using a secondary Vault
# NO external cloud provider dependencies required!
#
# Architecture:
# - vault-unseal: Secondary Vault that provides transit encryption
# - vault: Primary Vault that uses transit seal for auto-unseal
#
# After setup:
# - vault-unseal must be manually unsealed after restart (3 of 5 keys)
# - vault will auto-unseal using vault-unseal's transit engine
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"
KEYS_DIR="${SCRIPT_DIR}/../.keys"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vault addresses
VAULT_UNSEAL_ADDR="${VAULT_UNSEAL_ADDR:-https://localhost:8210}"
VAULT_PRIMARY_ADDR="${VAULT_PRIMARY_ADDR:-https://localhost:8200}"
VAULT_CACERT="${CONFIG_DIR}/vault/tls/ca.crt"

echo -e "${BLUE}=== ThaliumX Transit Auto-Unseal Setup ===${NC}"
echo ""
echo "This script configures auto-unseal WITHOUT cloud providers."
echo ""
echo "Vault Unseal Server: ${VAULT_UNSEAL_ADDR}"
echo "Vault Primary Server: ${VAULT_PRIMARY_ADDR}"
echo ""

# Create keys directory
mkdir -p "${KEYS_DIR}"
chmod 700 "${KEYS_DIR}"

# ===========================================
# Step 1: Initialize Vault Unseal Server
# ===========================================
echo -e "${YELLOW}Step 1: Initializing Vault Unseal Server...${NC}"

UNSEAL_INIT_STATUS=$(curl -sk "${VAULT_UNSEAL_ADDR}/v1/sys/init" | jq -r '.initialized')

if [ "${UNSEAL_INIT_STATUS}" == "false" ]; then
    echo "Initializing vault-unseal..."
    
    UNSEAL_INIT=$(curl -sk --request POST \
        --data '{"secret_shares": 5, "secret_threshold": 3}' \
        "${VAULT_UNSEAL_ADDR}/v1/sys/init")
    
    # Save keys
    echo "${UNSEAL_INIT}" > "${KEYS_DIR}/vault-unseal-keys.json"
    chmod 600 "${KEYS_DIR}/vault-unseal-keys.json"
    
    echo -e "${GREEN}✓ Vault unseal server initialized${NC}"
    echo ""
    echo -e "${RED}=== CRITICAL: SAVE THESE KEYS SECURELY ===${NC}"
    echo "Keys saved to: ${KEYS_DIR}/vault-unseal-keys.json"
    echo ""
    echo "Unseal Keys:"
    echo "${UNSEAL_INIT}" | jq -r '.keys_base64[]' | nl
    echo ""
    echo "Root Token:"
    echo "${UNSEAL_INIT}" | jq -r '.root_token'
    echo ""
else
    echo -e "${GREEN}✓ Vault unseal server already initialized${NC}"
    
    if [ -f "${KEYS_DIR}/vault-unseal-keys.json" ]; then
        UNSEAL_INIT=$(cat "${KEYS_DIR}/vault-unseal-keys.json")
    else
        echo -e "${RED}ERROR: Keys file not found. Manual intervention required.${NC}"
        exit 1
    fi
fi

# ===========================================
# Step 2: Unseal Vault Unseal Server
# ===========================================
echo ""
echo -e "${YELLOW}Step 2: Unsealing Vault Unseal Server...${NC}"

UNSEAL_SEALED=$(curl -sk "${VAULT_UNSEAL_ADDR}/v1/sys/seal-status" | jq -r '.sealed')

if [ "${UNSEAL_SEALED}" == "true" ]; then
    echo "Unsealing vault-unseal..."
    
    KEY1=$(echo "${UNSEAL_INIT}" | jq -r '.keys_base64[0]')
    KEY2=$(echo "${UNSEAL_INIT}" | jq -r '.keys_base64[1]')
    KEY3=$(echo "${UNSEAL_INIT}" | jq -r '.keys_base64[2]')
    
    curl -sk --request POST --data "{\"key\": \"${KEY1}\"}" "${VAULT_UNSEAL_ADDR}/v1/sys/unseal" > /dev/null
    curl -sk --request POST --data "{\"key\": \"${KEY2}\"}" "${VAULT_UNSEAL_ADDR}/v1/sys/unseal" > /dev/null
    curl -sk --request POST --data "{\"key\": \"${KEY3}\"}" "${VAULT_UNSEAL_ADDR}/v1/sys/unseal" > /dev/null
    
    echo -e "${GREEN}✓ Vault unseal server unsealed${NC}"
else
    echo -e "${GREEN}✓ Vault unseal server already unsealed${NC}"
fi

# Get root token
UNSEAL_ROOT_TOKEN=$(echo "${UNSEAL_INIT}" | jq -r '.root_token')

# ===========================================
# Step 3: Configure Transit Engine
# ===========================================
echo ""
echo -e "${YELLOW}Step 3: Configuring Transit Engine...${NC}"

# Enable transit secrets engine
TRANSIT_ENABLED=$(curl -sk -H "X-Vault-Token: ${UNSEAL_ROOT_TOKEN}" \
    "${VAULT_UNSEAL_ADDR}/v1/sys/mounts" | jq -r '.["transit/"]')

if [ "${TRANSIT_ENABLED}" == "null" ]; then
    echo "Enabling transit secrets engine..."
    
    curl -sk --request POST \
        -H "X-Vault-Token: ${UNSEAL_ROOT_TOKEN}" \
        --data '{"type": "transit"}' \
        "${VAULT_UNSEAL_ADDR}/v1/sys/mounts/transit"
    
    echo -e "${GREEN}✓ Transit engine enabled${NC}"
else
    echo -e "${GREEN}✓ Transit engine already enabled${NC}"
fi

# Create autounseal key
echo "Creating autounseal encryption key..."

curl -sk --request POST \
    -H "X-Vault-Token: ${UNSEAL_ROOT_TOKEN}" \
    --data '{"type": "aes256-gcm96"}' \
    "${VAULT_UNSEAL_ADDR}/v1/transit/keys/autounseal" 2>/dev/null || true

echo -e "${GREEN}✓ Autounseal key created${NC}"

# ===========================================
# Step 4: Create Policy for Auto-Unseal
# ===========================================
echo ""
echo -e "${YELLOW}Step 4: Creating Auto-Unseal Policy...${NC}"

POLICY_PAYLOAD=$(cat <<EOF
{
  "policy": "path \"transit/encrypt/autounseal\" {\n  capabilities = [\"update\"]\n}\n\npath \"transit/decrypt/autounseal\" {\n  capabilities = [\"update\"]\n}"
}
EOF
)

curl -sk --request PUT \
    -H "X-Vault-Token: ${UNSEAL_ROOT_TOKEN}" \
    --data "${POLICY_PAYLOAD}" \
    "${VAULT_UNSEAL_ADDR}/v1/sys/policies/acl/autounseal"

echo -e "${GREEN}✓ Auto-unseal policy created${NC}"

# ===========================================
# Step 5: Create Token for Primary Vault
# ===========================================
echo ""
echo -e "${YELLOW}Step 5: Creating Token for Primary Vault...${NC}"

TOKEN_RESPONSE=$(curl -sk --request POST \
    -H "X-Vault-Token: ${UNSEAL_ROOT_TOKEN}" \
    --data '{"policies": ["autounseal"], "ttl": "87600h", "renewable": true, "no_parent": true}' \
    "${VAULT_UNSEAL_ADDR}/v1/auth/token/create-orphan")

TRANSIT_TOKEN=$(echo "${TOKEN_RESPONSE}" | jq -r '.auth.client_token')

# Save token
echo "${TRANSIT_TOKEN}" > "${KEYS_DIR}/transit-token"
chmod 600 "${KEYS_DIR}/transit-token"

echo -e "${GREEN}✓ Transit token created${NC}"
echo "Token saved to: ${KEYS_DIR}/transit-token"

# ===========================================
# Step 6: Generate Primary Vault Config
# ===========================================
echo ""
echo -e "${YELLOW}Step 6: Generating Primary Vault Configuration...${NC}"

cat > "${CONFIG_DIR}/vault/vault-transit-seal.hcl" << EOF
# ===========================================
# Vault Production Configuration with Transit Seal
# ===========================================
# Auto-generated by setup-transit-autounseal.sh
# This configuration uses Transit seal for auto-unseal
# ===========================================

# Storage backend
storage "file" {
  path = "/vault/data"
}

# Listener configuration with TLS
listener "tcp" {
  address       = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  
  tls_disable   = false
  tls_cert_file = "/vault/config/tls/vault.crt"
  tls_key_file  = "/vault/config/tls/vault.key"
  tls_client_ca_file = "/vault/config/tls/ca.crt"
  
  tls_min_version = "tls12"
}

# API address
api_addr = "https://thaliumx-vault:8200"
cluster_addr = "https://thaliumx-vault:8201"

# Disable mlock
disable_mlock = true

# UI
ui = true

# Telemetry
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
  unauthenticated_metrics_access = true
}

# Lease TTLs
default_lease_ttl = "768h"
max_lease_ttl = "8760h"

# Logging
log_level = "info"
log_format = "json"

# ===========================================
# Transit Seal Configuration
# ===========================================
# Auto-unseal using vault-unseal server
seal "transit" {
  address         = "https://thaliumx-vault-unseal:8200"
  token           = "${TRANSIT_TOKEN}"
  disable_renewal = "false"
  
  # Key configuration
  key_name        = "autounseal"
  mount_path      = "transit/"
  
  # TLS configuration
  tls_ca_cert     = "/vault/config/tls/ca.crt"
}
EOF

echo -e "${GREEN}✓ Transit seal configuration generated${NC}"
echo "Config saved to: ${CONFIG_DIR}/vault/vault-transit-seal.hcl"

# ===========================================
# Summary
# ===========================================
echo ""
echo -e "${BLUE}=== Transit Auto-Unseal Setup Complete ===${NC}"
echo ""
echo "Files created:"
echo "  - ${KEYS_DIR}/vault-unseal-keys.json (ENCRYPT THIS!)"
echo "  - ${KEYS_DIR}/transit-token"
echo "  - ${CONFIG_DIR}/vault/vault-transit-seal.hcl"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Securely backup ${KEYS_DIR}/vault-unseal-keys.json"
echo "2. Update compose.production.yaml to use vault-transit-seal.hcl"
echo "3. Uncomment vault-unseal service in compose.production.yaml"
echo "4. Restart primary vault - it will auto-unseal!"
echo ""
echo -e "${RED}IMPORTANT:${NC}"
echo "- vault-unseal must be manually unsealed after restart"
echo "- Keep vault-unseal keys distributed among trusted admins"
echo "- Consider running vault-unseal on a separate host"
echo ""
echo -e "${GREEN}Auto-unseal is now configured without cloud dependencies!${NC}"