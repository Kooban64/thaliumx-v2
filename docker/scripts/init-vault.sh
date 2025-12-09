#!/bin/bash

# ThaliumX Vault Initialization and Seeding Script
# ================================================
# Initializes Vault, unseals it, and loads all secrets

set -e

echo "🔐 Initializing ThaliumX Vault..."

# Remove existing container if it exists
echo "🧹 Cleaning up existing Vault container..."
docker rm -f thaliumx-vault 2>/dev/null || true

# Start Vault container
echo "🚀 Starting Vault container..."
docker run -d \
  --name thaliumx-vault \
  --network thaliumx-staging-net \
  -p 8200:8200 \
  -e VAULT_ADDR=http://127.0.0.1:8200 \
  -e VAULT_API_ADDR=http://vault:8200 \
  -v thaliumx-vault-data:/vault/data \
  hashicorp/vault:1.15 server -dev -dev-root-token-id=root

# Wait for Vault to start
echo "⏳ Waiting for Vault to start..."
sleep 5

# Check if Vault is running
docker exec thaliumx-vault vault status

# Enable KV secrets engine (may already be enabled in dev mode)
echo "🔧 Ensuring KV secrets engine is enabled..."
docker exec -e VAULT_TOKEN=root thaliumx-vault vault secrets enable -path=secret kv-v2 2>/dev/null || echo "KV engine already enabled"

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
    docker exec -e VAULT_TOKEN=root thaliumx-vault vault kv put -mount=secret thaliumx/$secret_name value="$secret_value"

    if [ $? -eq 0 ]; then
        echo "✅ Successfully loaded: $secret_name"
    else
        echo "❌ Failed to load: $secret_name"
        return 1
    fi
}

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
docker exec -e VAULT_TOKEN=root thaliumx-vault vault kv list -mount=secret thaliumx/

echo "🎉 Vault initialization and seeding complete!"
echo "🔑 Root token: root"
echo "🌐 Vault UI: http://localhost:8200"