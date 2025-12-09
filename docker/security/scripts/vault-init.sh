#!/bin/bash
# Vault Initialization Script
# This script initializes Vault with required secrets engines and secrets
# It runs automatically when Vault starts in dev mode

set -e

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-a0f1ad52a21cc1342c7f603d134e0f0e}"

export VAULT_ADDR
export VAULT_TOKEN

echo "Waiting for Vault to be ready..."
until vault status > /dev/null 2>&1; do
    sleep 1
done

echo "Vault is ready. Initializing secrets..."

# Enable KV secrets engine if not already enabled
if ! vault secrets list | grep -q "^kv/"; then
    echo "Enabling KV secrets engine..."
    vault secrets enable -path=kv kv-v2
else
    echo "KV secrets engine already enabled"
fi

# Create secrets for Ballerine
echo "Creating Ballerine secrets..."
vault kv put kv/fintech/ballerine \
    DATABASE_URL="postgresql://ballerine:ballerine_secure_password@thaliumx-ballerine-postgres:5432/ballerine" \
    SECRET_KEY="ballerine-secret-key-for-production" \
    API_KEY="ballerine-api-key-for-production" \
    BCRYPT_SALT="\$7\$CUdYR101dztpSnJjNAx9Q2\$ng" \
    MAGIC_LINK_JWT_SECRET="ballerine-magic-link-jwt-secret" \
    MAGIC_LINK_AUTH_JWT_SECRET="ballerine-magic-link-auth-jwt-secret" \
    NOTION_API_KEY="ballerine-notion-api-key"

# Create secrets for Backend
echo "Creating Backend secrets..."
vault kv put kv/fintech/backend \
    DATABASE_URL="postgresql://thaliumx:dW2QSkQnxJhaY2pP8mAt7YR9qtmbaHZ7@thaliumx-postgres:5432/thaliumx" \
    REDIS_URL="redis://:thaliumx_redis_password@thaliumx-redis:6379" \
    JWT_SECRET="thaliumx-jwt-secret-key-for-production" \
    ENCRYPTION_KEY="thaliumx-encryption-key-32bytes!"

# Create secrets for Keycloak
echo "Creating Keycloak secrets..."
vault kv put kv/fintech/keycloak \
    ADMIN_PASSWORD="thaliumx_keycloak_admin" \
    DB_PASSWORD="dW2QSkQnxJhaY2pP8mAt7YR9qtmbaHZ7"

# Create secrets for Kafka
echo "Creating Kafka secrets..."
vault kv put kv/fintech/kafka \
    SASL_USERNAME="admin" \
    SASL_PASSWORD="admin-secret"

# Create secrets for MongoDB
echo "Creating MongoDB secrets..."
vault kv put kv/fintech/mongodb \
    ROOT_USERNAME="admin" \
    ROOT_PASSWORD="thaliumx_mongo_password"

# Create secrets for PostgreSQL
echo "Creating PostgreSQL secrets..."
vault kv put kv/fintech/postgres \
    USERNAME="thaliumx" \
    PASSWORD="dW2QSkQnxJhaY2pP8mAt7YR9qtmbaHZ7"

# Create secrets for Redis
echo "Creating Redis secrets..."
vault kv put kv/fintech/redis \
    PASSWORD="thaliumx_redis_password"

# Create secrets for Dingir
echo "Creating Dingir secrets..."
vault kv put kv/fintech/dingir \
    DATABASE_URL="postgresql://thaliumx:dW2QSkQnxJhaY2pP8mAt7YR9qtmbaHZ7@thaliumx-postgres:5432/dingir" \
    KAFKA_BROKERS="thaliumx-kafka:9092"

# Create secrets for BlinkFinance
echo "Creating BlinkFinance secrets..."
vault kv put kv/fintech/blinkfinance \
    API_KEY="blinkfinance-api-key" \
    SECRET_KEY="blinkfinance-secret-key"

echo "Vault initialization complete!"