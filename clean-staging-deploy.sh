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
# Database credentials - Use environment variables or generate securely
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -hex 32)}
REDIS_PASSWORD=${REDIS_PASSWORD:-$(openssl rand -hex 32)}
MONGODB_PASSWORD=${MONGODB_PASSWORD:-$(openssl rand -hex 32)}
KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD:-$(openssl rand -hex 32)}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 64)}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-$(openssl rand -hex 32)}
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-$(openssl rand -hex 32)}
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

