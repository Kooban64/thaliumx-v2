#!/bin/bash

echo "🧪 ThaliumX Staging Infrastructure Test"
echo "======================================"

# Check Docker
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker not running"
    exit 1
fi
echo "✅ Docker running"

# Create minimal staging environment
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

# Start only core infrastructure (no custom builds)
echo "🐳 Starting core infrastructure..."

# Start databases
docker run -d --name thaliumx-postgres-staging \
  --network thaliumx-staging-net \
  -e POSTGRES_PASSWORD=staging_password_123 \
  -e POSTGRES_DB=thaliumx \
  -p 5433:5432 \
  postgres:16-alpine

docker run -d --name thaliumx-redis-staging \
  --network thaliumx-staging-net \
  -p 6380:6379 \
  redis:7-alpine

# Start monitoring
docker run -d --name thaliumx-grafana-staging \
  --network thaliumx-staging-net \
  -e GF_SECURITY_ADMIN_PASSWORD=staging_grafana_123 \
  -p 3001:3000 \
  grafana/grafana:10.2.2

# Start Keycloak
docker run -d --name thaliumx-keycloak-staging \
  --network thaliumx-staging-net \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=staging_keycloak_123 \
  -p 8081:8080 \
  quay.io/keycloak/keycloak:23.0 \
  start-dev

echo "⏳ Waiting for services to start..."
sleep 30

# Test services
echo "🧪 Testing core services..."
docker ps --filter "name=thaliumx-*-staging" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test connectivity
echo ""
echo "🔍 Service Status:"
curl -s http://localhost:3001 >/dev/null && echo "✅ Grafana: http://localhost:3001 (admin/staging_grafana_123)" || echo "⚠️ Grafana not ready"
curl -s http://localhost:8081 >/dev/null && echo "✅ Keycloak: http://localhost:8081 (admin/staging_keycloak_123)" || echo "⚠️ Keycloak not ready"

echo ""
echo "🎉 Core infrastructure deployed!"
echo "================================="
echo ""
echo "🌐 Staging URLs:"
echo "   Grafana: http://localhost:3001"
echo "   Keycloak: http://localhost:8081"
echo "   PostgreSQL: localhost:5433"
echo "   Redis: localhost:6380"
echo ""
echo "🛠️ Management:"
echo "   View logs: docker logs thaliumx-postgres-staging"
echo "   Stop all: docker stop \$(docker ps -q --filter 'name=thaliumx-*-staging')"
echo "   Remove all: docker rm \$(docker ps -aq --filter 'name=thaliumx-*-staging')"
echo ""
echo "✅ Core infrastructure ready for ThaliumX deployment testing!"

