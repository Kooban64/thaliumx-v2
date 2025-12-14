#!/bin/bash
# ThaliumX Production Start Script
# =================================
# Starts all services in production mode with persistence

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"

echo "=========================================="
echo "ThaliumX Production Start"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Step 1: Build shared package if needed
print_status "Building shared package..."
cd "$PROJECT_ROOT/docker/shared"
if [ ! -d "dist" ] || [ -z "$(ls -A dist 2>/dev/null)" ]; then
    npm install
    npm run build
    print_status "Shared package built"
else
    print_status "Shared package already built"
fi

# Step 2: Build backend if needed
print_status "Building backend..."
cd "$PROJECT_ROOT/docker/backend"
if [ ! -d "dist" ] || [ -z "$(ls -A dist 2>/dev/null)" ]; then
    npm install
    npm run build
    print_status "Backend built"
else
    print_status "Backend already built"
fi

# Step 3: Ensure network exists
print_status "Ensuring Docker network exists..."
cd "$DOCKER_DIR"
docker network inspect thaliumx-net >/dev/null 2>&1 || docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net
print_status "Network ready"

# Step 4: Start all services with override for persistence
print_status "Starting all services in production mode..."
cd "$DOCKER_DIR"
docker compose -f compose.yaml -f docker-compose.override.yml up -d --build

# Step 5: Wait for services
print_status "Waiting for services to start (60 seconds)..."
sleep 60

# Step 6: Show status
print_status "Service status:"
docker compose -f compose.yaml ps

echo ""
echo "=========================================="
print_status "Production services started!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check service health: docker compose -f docker/compose.yaml ps"
echo "2. View logs: docker compose -f docker/compose.yaml logs -f [service]"
echo "3. Run E2E tests: ./docker/scripts/run-e2e-tests.sh"
echo "4. Run load tests: ./docker/scripts/run-load-tests.sh load 100"
echo ""

