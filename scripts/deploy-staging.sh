#!/bin/bash
# =============================================================================
# ThaliumX Staging Deployment Script
# =============================================================================
# This script provides a repeatable, production-ready deployment process
# for the ThaliumX staging environment.
#
# Usage:
#   ./scripts/deploy-staging.sh [command]
#
# Commands:
#   start       - Start all services (default)
#   stop        - Stop all services
#   restart     - Restart all services
#   status      - Show status of all services
#   logs        - Show logs for all services
#   clean       - Stop and remove all containers (preserves data)
#   reset       - Full reset (removes containers and volumes - DATA LOSS!)
#   build       - Build all images
#   health      - Check health of all services
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"
SECRETS_DIR="$PROJECT_ROOT/.secrets/generated"

# Log functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Environment Setup
# =============================================================================
setup_environment() {
    log_info "Setting up environment variables..."
    
    # Check if secrets exist
    if [ ! -d "$SECRETS_DIR" ]; then
        log_error "Secrets directory not found: $SECRETS_DIR"
        log_info "Run ./scripts/generate-secrets.sh first"
        exit 1
    fi
    
    # Load secrets into environment
    export POSTGRES_PASSWORD=$(cat "$SECRETS_DIR/postgres-password" 2>/dev/null || echo "ThaliumX2025")
    export REDIS_PASSWORD=$(cat "$SECRETS_DIR/redis-password" 2>/dev/null || echo "ThaliumX2025")
    export MONGO_INITDB_ROOT_PASSWORD=$(cat "$SECRETS_DIR/mongodb-password" 2>/dev/null || echo "ThaliumX2025")
    export TYPESENSE_API_KEY=$(cat "$SECRETS_DIR/typesense-api-key" 2>/dev/null || echo "ThaliumX2025")
    export JWT_SECRET=$(cat "$SECRETS_DIR/jwt-secret" 2>/dev/null || echo "ThaliumX2025")
    export ENCRYPTION_KEY=$(cat "$SECRETS_DIR/encryption-key" 2>/dev/null || echo "ThaliumX2025")
    export KEYCLOAK_ADMIN_PASSWORD=$(cat "$SECRETS_DIR/keycloak-admin-password" 2>/dev/null || echo "ThaliumX2025")
    export GRAFANA_ADMIN_PASSWORD=$(cat "$SECRETS_DIR/grafana-admin-password" 2>/dev/null || echo "ThaliumX2025")
    export APISIX_ADMIN_KEY=$(cat "$SECRETS_DIR/apisix-admin-key" 2>/dev/null || echo "edd1c9f034335f136f87ad84b625c8f1")
    export VAULT_TOKEN="thaliumx-vault-token-2025"
    
    # Set default environment variables
    export COMPOSE_PROJECT_NAME=thaliumx
    export DOCKER_BUILDKIT=1
    
    log_success "Environment variables loaded"
}

# =============================================================================
# Network Setup
# =============================================================================
setup_network() {
    log_info "Setting up Docker network..."
    
    if ! docker network inspect thaliumx-net >/dev/null 2>&1; then
        docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net
        log_success "Created thaliumx-net network"
    else
        log_info "Network thaliumx-net already exists"
    fi
}

# =============================================================================
# Volume Setup
# =============================================================================
setup_volumes() {
    log_info "Setting up Docker volumes..."
    
    local volumes=(
        "thaliumx-postgres-data"
        "thaliumx-mongodb-data"
        "thaliumx-redis-data"
        "thaliumx-typesense-data"
        "thaliumx-kafka-data"
        "thaliumx-etcd-data"
        "thaliumx-keycloak-data"
        "thaliumx-vault-data"
        "thaliumx-vault-logs"
        "thaliumx-prometheus-data"
        "thaliumx-grafana-data"
        "thaliumx-loki-data"
        "thaliumx-tempo-data"
        "thaliumx-alertmanager-data"
        "thaliumx-apisix-logs"
    )
    
    for vol in "${volumes[@]}"; do
        if ! docker volume inspect "$vol" >/dev/null 2>&1; then
            docker volume create "$vol"
            log_info "Created volume: $vol"
        fi
    done
    
    log_success "All volumes ready"
}

# =============================================================================
# Wait for Service Health
# =============================================================================
wait_for_healthy() {
    local service=$1
    local max_wait=${2:-120}
    local wait_time=0
    
    log_info "Waiting for $service to be healthy..."
    
    while [ $wait_time -lt $max_wait ]; do
        local status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "not_found")
        
        if [ "$status" = "healthy" ]; then
            log_success "$service is healthy"
            return 0
        elif [ "$status" = "not_found" ]; then
            log_warn "$service not found, waiting..."
        fi
        
        sleep 5
        wait_time=$((wait_time + 5))
    done
    
    log_error "$service did not become healthy within ${max_wait}s"
    return 1
}

# =============================================================================
# Start Services by Layer
# =============================================================================
start_databases() {
    log_info "Starting database layer..."
    cd "$DOCKER_DIR"
    docker compose -f databases/compose.yaml up -d
    
    # Wait for databases to be healthy
    wait_for_healthy "thaliumx-postgres" 120
    wait_for_healthy "thaliumx-mongodb" 120
    wait_for_healthy "thaliumx-redis" 60
    wait_for_healthy "thaliumx-typesense" 60
    
    log_success "Database layer started"
}

start_citus() {
    log_info "Starting Citus cluster..."
    cd "$DOCKER_DIR"
    docker compose -f citus/compose.yaml up -d
    
    wait_for_healthy "thaliumx-citus-coordinator" 120
    wait_for_healthy "thaliumx-citus-worker-1" 60
    wait_for_healthy "thaliumx-citus-worker-2" 60
    
    log_success "Citus cluster started"
}

start_messaging() {
    log_info "Starting messaging layer..."
    cd "$DOCKER_DIR"
    docker compose -f messaging/compose.yaml up -d
    
    wait_for_healthy "thaliumx-kafka" 120
    wait_for_healthy "thaliumx-schema-registry" 60
    
    log_success "Messaging layer started"
}

start_security() {
    log_info "Starting security layer..."
    cd "$DOCKER_DIR"
    docker compose -f security/compose.yaml up -d
    
    wait_for_healthy "thaliumx-vault" 60
    wait_for_healthy "thaliumx-opa" 60
    # Keycloak takes longer to start
    wait_for_healthy "thaliumx-keycloak" 180
    
    log_success "Security layer started"
}

start_gateway() {
    log_info "Starting gateway layer..."
    cd "$DOCKER_DIR"
    docker compose -f gateway/compose.yaml up -d
    
    wait_for_healthy "thaliumx-etcd" 60
    wait_for_healthy "thaliumx-apisix" 60
    
    log_success "Gateway layer started"
}

start_observability() {
    log_info "Starting observability layer..."
    cd "$DOCKER_DIR"
    docker compose -f observability/compose.yaml up -d
    
    wait_for_healthy "thaliumx-prometheus" 60
    wait_for_healthy "thaliumx-grafana" 60
    wait_for_healthy "thaliumx-loki" 60
    
    log_success "Observability layer started"
}

start_core() {
    log_info "Starting core applications..."
    cd "$DOCKER_DIR"
    docker compose -f core/compose.yaml up -d --build
    
    wait_for_healthy "thaliumx-backend" 120
    wait_for_healthy "thaliumx-frontend" 120
    
    log_success "Core applications started"
}

start_trading() {
    log_info "Starting trading services..."
    cd "$DOCKER_DIR"
    
    if [ -f "trading/compose.yaml" ]; then
        docker compose -f trading/compose.yaml up -d
        log_success "Trading services started"
    else
        log_warn "Trading compose file not found, skipping..."
    fi
}

start_fintech() {
    log_info "Starting fintech services..."
    cd "$DOCKER_DIR"
    
    if [ -f "fintech/compose.yaml" ]; then
        docker compose -f fintech/compose.yaml up -d
        log_success "Fintech services started"
    else
        log_warn "Fintech compose file not found, skipping..."
    fi
}

start_wazuh() {
    log_info "Starting Wazuh SIEM..."
    cd "$DOCKER_DIR"
    
    if [ -f "wazuh/compose.yaml" ]; then
        docker compose -f wazuh/compose.yaml up -d
        log_success "Wazuh SIEM started"
    else
        log_warn "Wazuh compose file not found, skipping..."
    fi
}

# =============================================================================
# Main Start Function
# =============================================================================
start_all() {
    log_info "Starting ThaliumX Staging Environment..."
    echo "=============================================="
    
    setup_environment
    setup_network
    setup_volumes
    
    # Start services in dependency order
    start_databases
    start_citus
    start_messaging
    start_security
    start_gateway
    start_observability
    start_core
    start_trading
    start_fintech
    start_wazuh
    
    echo "=============================================="
    log_success "ThaliumX Staging Environment Started!"
    echo ""
    show_status
}

# =============================================================================
# Stop All Services
# =============================================================================
stop_all() {
    log_info "Stopping ThaliumX Staging Environment..."
    cd "$DOCKER_DIR"
    
    # Stop in reverse order
    [ -f "wazuh/compose.yaml" ] && docker compose -f wazuh/compose.yaml down 2>/dev/null || true
    [ -f "fintech/compose.yaml" ] && docker compose -f fintech/compose.yaml down 2>/dev/null || true
    [ -f "trading/compose.yaml" ] && docker compose -f trading/compose.yaml down 2>/dev/null || true
    docker compose -f core/compose.yaml down 2>/dev/null || true
    docker compose -f observability/compose.yaml down 2>/dev/null || true
    docker compose -f gateway/compose.yaml down 2>/dev/null || true
    docker compose -f security/compose.yaml down 2>/dev/null || true
    docker compose -f messaging/compose.yaml down 2>/dev/null || true
    docker compose -f citus/compose.yaml down 2>/dev/null || true
    docker compose -f databases/compose.yaml down 2>/dev/null || true
    
    log_success "All services stopped"
}

# =============================================================================
# Show Status
# =============================================================================
show_status() {
    log_info "Container Status:"
    echo ""
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "thaliumx|NAMES" | head -50
    echo ""
    
    local total=$(docker ps -a --format "{{.Names}}" | grep -c "thaliumx" || echo "0")
    local healthy=$(docker ps --format "{{.Names}}" | grep -c "thaliumx" || echo "0")
    
    log_info "Total containers: $total"
    log_info "Running containers: $healthy"
}

# =============================================================================
# Health Check
# =============================================================================
health_check() {
    log_info "Running health checks..."
    echo ""
    
    local services=(
        "thaliumx-postgres"
        "thaliumx-mongodb"
        "thaliumx-redis"
        "thaliumx-typesense"
        "thaliumx-kafka"
        "thaliumx-keycloak"
        "thaliumx-vault"
        "thaliumx-apisix"
        "thaliumx-prometheus"
        "thaliumx-grafana"
        "thaliumx-backend"
        "thaliumx-frontend"
    )
    
    local healthy=0
    local unhealthy=0
    
    for service in "${services[@]}"; do
        local status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "not_found")
        
        if [ "$status" = "healthy" ]; then
            echo -e "${GREEN}✓${NC} $service: healthy"
            healthy=$((healthy + 1))
        elif [ "$status" = "not_found" ]; then
            echo -e "${YELLOW}?${NC} $service: not found"
        else
            echo -e "${RED}✗${NC} $service: $status"
            unhealthy=$((unhealthy + 1))
        fi
    done
    
    echo ""
    log_info "Healthy: $healthy, Unhealthy: $unhealthy"
}

# =============================================================================
# Show Logs
# =============================================================================
show_logs() {
    local service=${1:-}
    
    if [ -n "$service" ]; then
        docker logs -f "thaliumx-$service"
    else
        log_info "Showing logs for all services (last 50 lines each)..."
        docker ps --format "{{.Names}}" | grep "thaliumx" | while read container; do
            echo "=== $container ==="
            docker logs --tail 50 "$container" 2>&1 | tail -20
            echo ""
        done
    fi
}

# =============================================================================
# Clean (preserve data)
# =============================================================================
clean() {
    log_warn "This will stop and remove all containers but preserve data volumes."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        stop_all
        docker container prune -f
        log_success "Cleanup complete. Data volumes preserved."
    fi
}

# =============================================================================
# Reset (remove everything including data)
# =============================================================================
reset() {
    log_error "WARNING: This will remove ALL containers AND data volumes!"
    log_error "All data will be PERMANENTLY LOST!"
    read -p "Type 'RESET' to confirm: " confirm
    
    if [ "$confirm" = "RESET" ]; then
        stop_all
        
        # Remove all thaliumx volumes
        docker volume ls --format "{{.Name}}" | grep "thaliumx" | xargs -r docker volume rm
        
        # Remove network
        docker network rm thaliumx-net 2>/dev/null || true
        
        log_success "Full reset complete. All data removed."
    else
        log_info "Reset cancelled."
    fi
}

# =============================================================================
# Build Images
# =============================================================================
build_images() {
    log_info "Building Docker images..."
    cd "$DOCKER_DIR"
    
    setup_environment
    
    docker compose -f core/compose.yaml build
    
    log_success "Images built successfully"
}

# =============================================================================
# Main
# =============================================================================
main() {
    local command=${1:-start}
    
    case $command in
        start)
            start_all
            ;;
        stop)
            stop_all
            ;;
        restart)
            stop_all
            sleep 5
            start_all
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${2:-}"
            ;;
        clean)
            clean
            ;;
        reset)
            reset
            ;;
        build)
            build_images
            ;;
        health)
            health_check
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|logs|clean|reset|build|health}"
            exit 1
            ;;
    esac
}

main "$@"