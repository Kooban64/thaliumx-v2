#!/bin/bash
# ThaliumX Credential Rotation Script
# ====================================
# This script generates secure random credentials and updates configuration files
# Run this script before production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ThaliumX Credential Rotation Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Function to generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*()_+-=' | head -c "$length"
}

# Function to generate alphanumeric password (for services that don't support special chars)
generate_alphanum_password() {
    local length=${1:-32}
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

# Function to generate hex token
generate_hex_token() {
    local length=${1:-64}
    openssl rand -hex "$((length/2))"
}

# Generate new credentials
echo -e "${YELLOW}Generating new secure credentials...${NC}"

POSTGRES_PASSWORD=$(generate_alphanum_password 32)
MONGO_PASSWORD=$(generate_alphanum_password 32)
MONGO_APP_PASSWORD=$(generate_alphanum_password 32)
REDIS_PASSWORD=$(generate_alphanum_password 32)
AUTHENTIK_ADMIN_PASSWORD=$(generate_password 24)
VAULT_TOKEN=$(generate_hex_token 32)
TYPESENSE_API_KEY=$(generate_alphanum_password 32)
GRAFANA_ADMIN_PASSWORD=$(generate_password 24)
JWT_SECRET=$(generate_hex_token 64)
SESSION_SECRET=$(generate_hex_token 64)
MAGIC_LINK_SECRET=$(generate_hex_token 64)
HASHING_KEY=$(generate_alphanum_password 32)
ENCRYPTION_KEY=$(generate_hex_token 64)
BLNK_SECRET_KEY=$(generate_hex_token 32)
AUTHENTIK_BACKEND_SECRET=$(generate_hex_token 32)
AUTHENTIK_TRADING_SECRET=$(generate_hex_token 32)
AUTHENTIK_FINTECH_SECRET=$(generate_hex_token 32)
APISIX_ADMIN_KEY=$(generate_hex_token 32)

# Backup existing .env file
ENV_FILE="docker/.env"
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✓ Backed up existing .env file${NC}"
fi

# Create new .env file with rotated credentials
cat > "$ENV_FILE" << EOF
# ThaliumX Production Environment Configuration
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# WARNING: Keep this file secure and never commit to version control

# ===========================================
# DATABASE CREDENTIALS
# ===========================================
POSTGRES_USER=thaliumx
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=thaliumx

MONGO_INITDB_ROOT_USERNAME=thaliumx
MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
MONGO_APP_USERNAME=thaliumx
MONGO_APP_PASSWORD=${MONGO_APP_PASSWORD}

REDIS_PASSWORD=${REDIS_PASSWORD}

# ===========================================
# AUTHENTICATION & IDENTITY
# ===========================================
AUTHENTIK_ADMIN=admin
AUTHENTIK_ADMIN_PASSWORD=${AUTHENTIK_ADMIN_PASSWORD}
AUTHENTIK_BACKEND_CLIENT_SECRET=${AUTHENTIK_BACKEND_SECRET}
AUTHENTIK_TRADING_CLIENT_SECRET=${AUTHENTIK_TRADING_SECRET}
AUTHENTIK_FINTECH_CLIENT_SECRET=${AUTHENTIK_FINTECH_SECRET}

# ===========================================
# SECRETS MANAGEMENT
# ===========================================
VAULT_DEV_ROOT_TOKEN_ID=${VAULT_TOKEN}
VAULT_TOKEN=${VAULT_TOKEN}

# ===========================================
# APPLICATION SECRETS
# ===========================================
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
MAGIC_LINK_AUTH_JWT_SECRET=${MAGIC_LINK_SECRET}
HASHING_KEY_SECRET=${HASHING_KEY}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
BLNK_SECRET_KEY=${BLNK_SECRET_KEY}

# ===========================================
# SEARCH & MONITORING
# ===========================================
TYPESENSE_API_KEY=${TYPESENSE_API_KEY}
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}

# ===========================================
# NETWORK CONFIGURATION
# ===========================================
BACKEND_PORT=3002
FRONTEND_PORT=3000
APISIX_PORT=9080
APISIX_SSL_PORT=9443
APISIX_ADMIN_KEY=${APISIX_ADMIN_KEY}
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
ALERTMANAGER_PORT=9093

# ===========================================
# EXTERNAL SERVICES (Configure for production)
# ===========================================
# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# Slack Webhook (for alerts)
SLACK_WEBHOOK_URL=

# PagerDuty (for critical alerts)
PAGERDUTY_SERVICE_KEY=
PAGERDUTY_SECURITY_KEY=

# ===========================================
# BLOCKCHAIN CONFIGURATION
# ===========================================
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org
DEPLOYER_PRIVATE_KEY=

# ===========================================
# FEATURE FLAGS
# ===========================================
ENABLE_MFA=true
ENABLE_KYC=true
ENABLE_TRADING=true
ENABLE_MARGIN_TRADING=false
EOF

# Also write backend env_file used by docker/core/compose.yaml (gitignored)
CORE_ENV_FILE="docker/core/core.env"
mkdir -p docker/core
cat > "$CORE_ENV_FILE" << EOF
# GENERATED FILE (local-only)
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# WARNING: do not commit

NODE_ENV=production
PORT=3002

DB_HOST=thaliumx-citus-coordinator
DB_PORT=5432
DB_NAME=thaliumx
DB_USER=thaliumx
DB_PASSWORD=${POSTGRES_PASSWORD}
DB_SSL=false

REDIS_HOST=thaliumx-redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

VAULT_ADDR=http://thaliumx-vault:8200
VAULT_TOKEN=${VAULT_TOKEN}

MONGO_APP_USERNAME=thaliumx
MONGO_APP_PASSWORD=${MONGO_APP_PASSWORD}
MONGODB_URI=mongodb://thaliumx:${MONGO_APP_PASSWORD}@thaliumx-mongodb:27017/thaliumx?authSource=admin

TYPESENSE_API_KEY=${TYPESENSE_API_KEY}
EOF

# Compose v2 "include" uses per-subproject directories; ensure each has a .env for interpolation.
for d in core databases security gateway observability trading fintech compliance wazuh apisix kafka Authentik mongodb postgres redis timescaledb citus; do
  if [ -d "docker/$d" ]; then
    cp -f "$ENV_FILE" "docker/$d/.env" || true
  fi
done

echo -e "${GREEN}✓ Created new .env file with rotated credentials${NC}"

# Create a secure credentials file for reference (store securely!)
CREDS_FILE="docker/.credentials.$(date +%Y%m%d_%H%M%S).txt"
cat > "$CREDS_FILE" << EOF
# ThaliumX Production Credentials
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# STORE THIS FILE SECURELY AND DELETE AFTER NOTING CREDENTIALS

PostgreSQL Password: ${POSTGRES_PASSWORD}
MongoDB Password: ${MONGO_PASSWORD}
MongoDB App Password: ${MONGO_APP_PASSWORD}
Redis Password: ${REDIS_PASSWORD}
Authentik Admin Password: ${AUTHENTIK_ADMIN_PASSWORD}
Vault Token: ${VAULT_TOKEN}
APISIX Admin Key: ${APISIX_ADMIN_KEY}
Typesense API Key: ${TYPESENSE_API_KEY}
Grafana Admin Password: ${GRAFANA_ADMIN_PASSWORD}
JWT Secret: ${JWT_SECRET}
Session Secret: ${SESSION_SECRET}
Magic Link Secret: ${MAGIC_LINK_SECRET}
Hashing Key: ${HASHING_KEY}
Encryption Key: ${ENCRYPTION_KEY}
BLNK Secret Key: ${BLNK_SECRET_KEY}
Authentik Backend Client Secret: ${AUTHENTIK_BACKEND_SECRET}
Authentik Trading Client Secret: ${AUTHENTIK_TRADING_SECRET}
Authentik Fintech Client Secret: ${AUTHENTIK_FINTECH_SECRET}
EOF

chmod 600 "$CREDS_FILE"
echo -e "${GREEN}✓ Created credentials reference file: ${CREDS_FILE}${NC}"
echo -e "${YELLOW}  ⚠️  Store this file securely and delete after noting credentials!${NC}"

# Update docker-compose files to use environment variables
echo ""
echo -e "${YELLOW}Updating service configurations...${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Credential Rotation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "1. ${YELLOW}Review the new credentials in: ${CREDS_FILE}${NC}"
echo -e "2. ${YELLOW}Store credentials securely (password manager, vault, etc.)${NC}"
echo -e "3. ${YELLOW}Delete the credentials file after storing: rm ${CREDS_FILE}${NC}"
echo -e "4. ${YELLOW}Restart all services: docker compose down && docker compose up -d${NC}"
echo -e "5. ${YELLOW}Update Vault with new secrets${NC}"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Never commit .env or credentials files to git!${NC}"
