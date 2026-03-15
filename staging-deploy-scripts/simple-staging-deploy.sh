#!/bin/bash

# Simple ThaliumX Staging Deployment (skips system setup)

echo "🚀 Simple ThaliumX Staging Deployment"
echo "====================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Create staging environment file
cat > .env.staging << EOF
# ThaliumX Staging Environment
NODE_ENV=staging
DOMAIN=localhost
API_DOMAIN=localhost
AUTH_DOMAIN=localhost

# Staging-specific settings
ENABLE_DEBUG_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true
ALLOW_TEST_USERS=true
USE_SANDBOX_APIS=true

# Rate limiting (reduced for staging)
RATE_LIMIT_REQUESTS_PER_MINUTE=100
MAX_CONCURRENT_USERS=50

# Database Configuration
POSTGRES_PASSWORD=staging_password_123
REDIS_PASSWORD=staging_redis_123
MONGODB_PASSWORD=staging_mongo_123

# Authentik Configuration
AUTHENTIK_ADMIN_PASSWORD=staging_Authentik_123

# JWT & Encryption
JWT_SECRET=staging_jwt_secret_very_long_and_secure_key_for_testing
ENCRYPTION_KEY=staging_encryption_key_32_chars_long

# Grafana
GRAFANA_ADMIN_PASSWORD=staging_grafana_123

# Server Configuration
SERVER_IP=127.0.0.1

# Staging overrides - use testnet/sandbox where possible
ETHEREUM_NETWORK=sepolia
BSC_NETWORK=testnet
USE_SANDBOX_APIS=true
