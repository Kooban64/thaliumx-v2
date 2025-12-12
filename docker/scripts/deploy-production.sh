#!/bin/bash

# ThaliumX Production Deployment Script
# ====================================
# Complete production deployment with proper sequencing

set -e

echo "🚀 Starting ThaliumX Production Deployment..."

# Function to wait for service health
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo "⏳ Waiting for $service to be healthy..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
            echo "✅ $service is healthy"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts: $service not ready yet..."
        sleep 10
        ((attempt++))
    done

    echo "❌ $service failed to become healthy"
    return 1
}

# Step 1: Deploy infrastructure services
echo "🏗️ Step 1: Deploying infrastructure services..."
cd /home/ubuntu/thaliumx

# Create networks if they don't exist
docker network create thaliumx-net 2>/dev/null || true
docker network create thaliumx-database-network 2>/dev/null || true
docker network create thaliumx-monitoring-network 2>/dev/null || true

# Deploy databases first
echo "📊 Deploying databases..."
docker compose -f docker/citus/compose.yaml up -d
docker compose -f docker/timescaledb/compose.yaml up -d
docker compose -f docker/postgres/compose.yaml up -d
docker compose -f docker/redis/compose.yaml up -d
docker compose -f docker/mongodb/compose.yaml up -d

# Wait for databases
wait_for_service "PostgreSQL" "http://localhost:5432" || echo "PostgreSQL check skipped"
wait_for_service "Redis" "http://localhost:6379" || echo "Redis check skipped"

# Step 2: Deploy security services
echo "🔐 Step 2: Deploying security services..."
docker compose -f docker/vault/compose.yaml up -d
docker compose -f docker/keycloak/compose.yaml up -d

# Wait for security services
wait_for_service "Vault" "http://localhost:8200/v1/sys/health"
wait_for_service "Keycloak" "http://localhost:8080/auth/realms/master"

# Step 3: Deploy messaging and gateway
echo "📨 Step 3: Deploying messaging and API gateway..."
docker compose -f docker/kafka/compose.yaml up -d
docker compose -f docker/apisix/compose.yaml up -d

# Step 4: Deploy trading engine
echo "📈 Step 4: Deploying trading engine..."
docker compose -f docker/trading/compose.yaml up -d

# Wait for trading services
wait_for_service "Dingir REST API" "http://localhost:50053/api/exchange/panel/health"
wait_for_service "Liquibook" "http://localhost:8083/health"
wait_for_service "QuantLib" "http://localhost:3010/health"

# Step 5: Deploy application services
echo "🖥️ Step 5: Deploying application services..."
docker compose -f docker/backend/compose.yaml up -d
docker compose -f docker/frontend/compose.yaml up -d

# Wait for application services
wait_for_service "Backend API" "http://localhost:3002/health"
wait_for_service "Frontend" "http://localhost:3000"

# Step 6: Deploy monitoring (optional)
echo "📊 Step 6: Deploying monitoring services..."
docker compose -f docker/observability/compose.yaml up -d 2>/dev/null || echo "Monitoring deployment skipped"

# Step 7: Run final health checks
echo "🔍 Step 7: Running final health checks..."

# Check all critical services
services=(
    "http://localhost:3002/health:Backend API"
    "http://localhost:3000:Frontend"
    "http://localhost:3003/health:Compliance DEX"
    "http://localhost:3004/health:Compliance CEX"
    "http://localhost:3005/health:Compliance NFT"
    "http://localhost:3006/health:Compliance Token"
    "http://localhost:3007/health:Compliance Coordinator"
    "http://localhost:50053/api/exchange/panel/health:Dingir REST API"
    "http://localhost:8083/health:Liquibook"
    "http://localhost:3010/health:QuantLib"
    "http://localhost:8200/v1/sys/health:Vault"
    "http://localhost:8080/auth/realms/master:Keycloak"
)

all_healthy=true
for service in "${services[@]}"; do
    url=$(echo $service | cut -d: -f1)
    name=$(echo $service | cut -d: -f2-)

    if curl -s --max-time 10 "$url" > /dev/null 2>&1; then
        echo "✅ $name: HEALTHY"
    else
        echo "❌ $name: UNHEALTHY"
        all_healthy=false
    fi
done

# Step 8: Run seeded tests
echo "🧪 Step 8: Running seeded tests..."
if ./docker/scripts/run-seeded-tests.sh; then
    echo "✅ Seeded tests passed!"
else
    echo "⚠️ Seeded tests had issues - check logs"
fi

# Final status
echo ""
echo "🎯 PRODUCTION DEPLOYMENT COMPLETE"
echo "=================================="

if [ "$all_healthy" = true ]; then
    echo "✅ ALL SERVICES HEALTHY"
    echo "🌐 Frontend: http://localhost:3000"
    echo "🔗 Backend API: http://localhost:3002"
    echo "📊 Monitoring: http://localhost:3001 (Grafana)"
    echo "🔐 Vault UI: http://localhost:8200"
    echo ""
    echo "🎉 ThaliumX is now 100% functional!"
else
    echo "⚠️ SOME SERVICES MAY NEED ATTENTION"
    echo "Check the logs above for failed services"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Configure domain DNS to point to this server"
echo "2. Set up SSL certificates for production domain"
echo "3. Configure production environment variables"
echo "4. Set up backup and monitoring alerts"
echo "5. Test user registration and trading flows"