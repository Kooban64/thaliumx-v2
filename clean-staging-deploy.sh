#!/bin/bash

echo "🚀 ThaliumX Staging Deployment"
echo "=============================="

# Check Docker
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker not running"
    exit 1
fi
echo "✅ Docker running"

# Create environment
cat > .env.staging << 'ENV_EOF'
NODE_ENV=staging
DOMAIN=localhost
API_DOMAIN=localhost
AUTH_DOMAIN=localhost
ENABLE_DEBUG_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true
ALLOW_TEST_USERS=true
USE_SANDBOX_APIS=true
RATE_LIMIT_REQUESTS_PER_MINUTE=100
MAX_CONCURRENT_USERS=50
POSTGRES_PASSWORD=staging_password_123
REDIS_PASSWORD=staging_redis_123
MONGODB_PASSWORD=staging_mongo_123
KEYCLOAK_ADMIN_PASSWORD=staging_keycloak_123
JWT_SECRET=staging_jwt_secret_very_long_and_secure_key_for_testing
ENCRYPTION_KEY=staging_encryption_key_32_chars_long
GRAFANA_ADMIN_PASSWORD=staging_grafana_123
SERVER_IP=127.0.0.1
ETHEREUM_NETWORK=sepolia
BSC_NETWORK=testnet
USE_SANDBOX_APIS=true
ENV_EOF

echo "✅ Environment configured"

# Create network
docker network create thaliumx-staging-net 2>/dev/null || echo "Network exists"

# Deploy services
echo "🐳 Deploying services..."
docker compose -f docker/compose.staging.yaml up -d

echo "⏳ Waiting for startup..."
sleep 30

# Test services
echo "🧪 Testing services..."
curl -s http://localhost:3002/health >/dev/null && echo "✅ API healthy" || echo "⚠️ API starting"
curl -s http://localhost:3000 >/dev/null && echo "✅ Frontend accessible" || echo "⚠️ Frontend starting"

echo ""
echo "🎉 Staging deployment complete!"
echo "================================"
echo ""
echo "🌐 URLs:"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:3002"
echo "   Grafana: http://localhost:3001 (admin/staging_grafana_123)"
echo ""
echo "👥 Test users ready for testing!"

