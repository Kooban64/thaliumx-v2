#!/bin/bash
# ThaliumX Production Setup Script
# =================================
# Sets up full production environment with persistence and testing capabilities

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"
DATA_DIR="/opt/thaliumx/data"

echo "=========================================="
echo "ThaliumX Production Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Step 1: Create data directories
print_status "Creating persistent data directories..."
sudo mkdir -p "$DATA_DIR"/{postgres,redis,mongodb,vault,vault-logs,vault-file,opa,Authentik,prometheus,grafana,loki,etcd,apisix-logs,kafka,typesense,citus-coordinator,citus-worker1,citus-worker2,dingir,dingir-logs,liquibook,liquibook-logs,quantlib,quantlib-cache,quantlib-models,alertmanager,tempo,wazuh-indexer,wazuh-api-config,wazuh-etc,wazuh-logs,wazuh-queue,wazuh-multigroups,wazuh-integrations,wazuh-active-response,wazuh-agentless,wazuh-wodles,filebeat-etc,filebeat-var,wazuh-dashboard-config,wazuh-dashboard-custom,ballerine-postgres,blnkfinance,timescaledb,support-postgres,graphql-cache} 2>/dev/null || true
sudo chown -R "$USER:$USER" /opt/thaliumx 2>/dev/null || true
print_status "Data directories created"

# Step 2: Create Docker network
print_status "Creating Docker network..."
cd "$DOCKER_DIR"
docker network inspect thaliumx-net >/dev/null 2>&1 || docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net
print_status "Docker network ready"

# Step 3: Set production environment
print_status "Setting production environment variables..."
export NODE_ENV=production
export COMPOSE_PROJECT_NAME=thaliumx

# Step 4: Build all services
print_status "Building all services (this may take a while)..."
cd "$DOCKER_DIR"
docker compose -f compose.yaml build --parallel 2>&1 | tee /tmp/thaliumx-build.log

# Step 5: Start infrastructure services first
print_status "Starting infrastructure services (databases, messaging, security)..."
docker compose -f compose.yaml up -d postgres mongodb redis typesense
docker compose -f compose.yaml up -d citus-coordinator citus-worker-1 citus-worker-2
docker compose -f compose.yaml up -d timescaledb support-postgres
docker compose -f compose.yaml up -d kafka schema-registry
docker compose -f compose.yaml up -d Authentik vault opa

# Wait for infrastructure to be healthy
print_status "Waiting for infrastructure services to be healthy..."
sleep 30

# Step 6: Start gateway and core services
print_status "Starting gateway and core services..."
docker compose -f compose.yaml up -d etcd apisix
docker compose -f compose.yaml up -d backend frontend graphql

# Step 7: Start trading services
print_status "Starting trading services..."
docker compose -f compose.yaml up -d dingir-matchengine dingir-restapi liquibook quantlib

# Step 8: Start fintech services
print_status "Starting fintech services..."
docker compose -f compose.yaml up -d ballerine-postgres ballerine-workflow ballerine-backoffice blnkfinance

# Step 9: Start compliance services
print_status "Starting compliance services..."
docker compose -f compose.yaml up -d compliance-cex compliance-dex compliance-nft compliance-token compliance-coordinator

# Step 10: Start support services
print_status "Starting support services..."
docker compose -f compose.yaml up -d support-moderation-analytics live-helper-chat osticket

# Step 11: Start observability
print_status "Starting observability stack..."
docker compose -f compose.yaml up -d prometheus grafana loki promtail tempo otel-collector alertmanager blackbox-exporter cadvisor postgres-exporter redis-exporter

# Step 12: Start security monitoring
print_status "Starting security monitoring (Wazuh)..."
docker compose -f compose.yaml up -d wazuh-indexer wazuh-manager wazuh-dashboard

# Step 13: Wait for all services
print_status "Waiting for all services to start..."
sleep 60

# Step 14: Check service health
print_status "Checking service health..."
cd "$DOCKER_DIR"
docker compose -f compose.yaml ps

echo ""
echo "=========================================="
print_status "Production setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify all services: docker ps --filter 'name=thaliumx-'"
echo "2. Check logs: docker compose -f docker/compose.yaml logs -f"
echo "3. Run E2E tests: ./docker/scripts/run-e2e-tests.sh"
echo "4. Run load tests: ./docker/scripts/run-load-tests.sh"
echo ""

