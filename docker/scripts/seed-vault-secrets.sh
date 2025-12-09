#!/bin/bash

# ThaliumX Vault Secrets Seeding Script
# ====================================
# Loads all generated secrets into HashiCorp Vault

set -e

echo "🔐 Seeding ThaliumX secrets into Vault..."

# Function to load secret into Vault
load_secret() {
    local secret_name=$1
    local secret_file=".secrets/generated/${secret_name}"

    if [ ! -f "$secret_file" ]; then
        echo "❌ Secret file not found: $secret_file"
        return 1
    fi

    local secret_value=$(cat "$secret_file" | tr -d '\n')

    echo "📝 Loading secret: $secret_name"
    docker exec thaliumx-vault vault kv put -mount=secret thaliumx/$secret_name value="$secret_value"

    if [ $? -eq 0 ]; then
        echo "✅ Successfully loaded: $secret_name"
    else
        echo "❌ Failed to load: $secret_name"
        return 1
    fi
}

# Enable KV secrets engine if not already enabled
echo "🔧 Enabling KV secrets engine..."
docker exec thaliumx-vault vault secrets enable -path=secret kv-v2 2>/dev/null || echo "KV engine already enabled"

# Load all secrets
echo "🚀 Loading secrets..."

load_secret "postgres-password"
load_secret "redis-password"
load_secret "mongodb-password"
load_secret "jwt-secret"
load_secret "encryption-key"
load_secret "keycloak-admin-password"
load_secret "keycloak-backend-secret"
load_secret "keycloak-fintech-secret"
load_secret "keycloak-trading-secret"
load_secret "apisix-admin-key"
load_secret "kafka-password"
load_secret "vault-role-id"
load_secret "vault-secret-id"

echo "✅ All secrets loaded successfully!"

# Verify secrets were loaded
echo "🔍 Verifying secrets..."
docker exec thaliumx-vault vault kv list -mount=secret thaliumx/

echo "🎉 Vault seeding complete!"