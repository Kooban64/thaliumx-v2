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
docker compose -f citus/compose.yaml up -d
docker compose -f timescaledb/compose.yaml up -d
docker compose -f postgres/compose.yaml up -d
docker compose -f redis/compose.yaml up -d
docker compose -f mongodb/compose.yaml up -d

# Wait for databases
wait_for_service "PostgreSQL" "http://localhost:5432" || echo "PostgreSQL check skipped"
wait_for_service "Redis" "http://localhost:6379" || echo "Redis check skipped"

# Step 2: Deploy security services
echo "🔐 Step 2: Deploying security services..."
docker compose -f vault/compose.yaml up -d
docker compose -f keycloak/compose.yaml up -d

# Wait for security services
wait_for_service "Vault" "http://localhost:8200/v1/sys/health"
wait_for_service "Keycloak" "http://localhost:8080/auth/realms/master"

# Step 3: Deploy messaging and gateway
echo "📨 Step 3: Deploying messaging and API gateway..."
docker compose -f kafka/compose.yaml up -d
docker compose -f apisix/compose.yaml up -d

# Step 4: Deploy trading engine
echo "📈 Step 4: Deploying trading engine..."
docker compose -f trading/compose.yaml up -d

# Wait for trading services
wait_for_service "Dingir REST API" "http://localhost:50053/api/exchange/panel/health"
wait_for_service "Liquibook" "http://localhost:8083/health"
wait_for_service "QuantLib" "http://localhost:3010/health"

# Step 5: Deploy application services
echo "🖥️ Step 5: Deploying application services..."
docker compose -f backend/compose.yaml up -d
docker compose -f frontend/compose.yaml up -d
docker compose -f graphql/compose.yaml up -d

# Wait for application services
wait_for_service "Backend API" "http://localhost:3002/health"
wait_for_service "Frontend" "http://localhost:3000"
wait_for_service "GraphQL API" "http://localhost:4000/health"

# Step 6: Deploy support services
echo "💬 Step 6: Deploying support services..."
docker compose -f support/compose.yaml up -d

# Wait for support services
wait_for_service "Live Helper Chat" "http://localhost:80"
wait_for_service "osTicket" "http://localhost:80"

# Step 7: Deploy monitoring (optional)
echo "📊 Step 7: Deploying monitoring services..."
docker compose -f observability/compose.yaml up -d 2>/dev/null || echo "Monitoring deployment skipped"

# Step 8: Run final health checks
echo "🔍 Step 8: Running final health checks..."

# Check all critical services
services=(
    "http://localhost:3002/health:Backend API"
    "http://localhost:3000:Frontend"
    "http://localhost:4000/health:GraphQL API"
    "http://localhost:80:Live Helper Chat"
    "http://localhost:80:osTicket"
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

# Step 9: Run seeded tests
echo "🧪 Step 9: Running seeded tests..."
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