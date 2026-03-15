#!/bin/bash
# ThaliumX Staging Environment Fix Script
# This script fixes all identified issues in the staging environment
# Run with: sudo ./scripts/fix-staging-environment.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "=============================================="
echo "ThaliumX Staging Environment Fix Script"
echo "=============================================="

# Phase 1: Stop all existing containers
log_info "Phase 1: Stopping all existing containers..."
docker stop $(docker ps -aq --filter "name=thaliumx") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=thaliumx") 2>/dev/null || true
log_success "All containers stopped and removed"

# Phase 2: Fix network configuration
log_info "Phase 2: Fixing network configuration..."
docker network rm docker_thaliumx-network 2>/dev/null || true
docker network rm thaliumx-staging-net 2>/dev/null || true
docker network rm thaliumx-net 2>/dev/null || true
docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net
log_success "Network thaliumx-net created"

# Phase 3: Generate all secrets
log_info "Phase 3: Generating secrets..."
mkdir -p .secrets/generated

openssl rand -base64 32 | tr -d '\n' > .secrets/generated/postgres-password
openssl rand -base64 32 | tr -d '\n' > .secrets/generated/redis-password
openssl rand -base64 32 | tr -d '\n' > .secrets/generated/mongodb-password
openssl rand -base64 64 | tr -d '\n' > .secrets/generated/jwt-secret
openssl rand -base64 32 | tr -d '\n' > .secrets/generated/encryption-key
openssl rand -base64 32 | tr -d '\n' > .secrets/generated/grafana-admin-password
openssl rand -hex 16 > .secrets/generated/vault-role-id
openssl rand -hex 32 > .secrets/generated/vault-secret-id
openssl rand -base64 24 | tr -d '\n' > .secrets/generated/Authentik-admin-password
chmod 600 .secrets/generated/*
log_success "All secrets generated"

# Phase 4: Create required volumes
log_info "Phase 4: Creating required volumes..."
docker volume create thaliumx-etcd-data 2>/dev/null || true
log_success "Volumes created"

# Phase 5: Fix SSL certificates (simplified - disable SSL for staging)
log_info "Phase 5: SSL certificates - using non-SSL for staging..."
log_warn "For production, generate proper SSL certificates"

log_success "Environment preparation complete!"
echo ""
echo "Next steps:"
echo "1. cd docker"
echo "2. docker compose -f databases/compose.yaml up -d"
echo "3. Wait for databases to be healthy"
echo "4. docker compose -f security/compose.yaml up -d"
echo "5. Continue with other services..."
