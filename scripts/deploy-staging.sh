#!/bin/bash

# ThaliumX Staging Deployment Script
# ==================================
# Automated deployment to staging environment for testing
#
# Usage:
#   ./deploy-staging.sh [start|stop|restart|status]
#
# This script deploys the scaled configuration to staging for validation

set -euo pipefail

# Configuration
DEPLOYMENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_DIR="$DEPLOYMENT_DIR/staging"
COMPOSE_FILE="$DEPLOYMENT_DIR/docker/compose.production-scaled.yaml"
ENV_FILE="$DEPLOYMENT_DIR/.env.staging"
BACKUP_DIR="$STAGING_DIR/backups/$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$STAGING_DIR/deploy.log"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
    log "SUCCESS: $1"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
    log "WARNING: $1"
}

info() {
    echo -e "${BLUE}INFO: $1${NC}"
    log "INFO: $1"
}

# Pre-flight checks
preflight_checks() {
    info "Running pre-flight checks..."

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running"
    fi

    # Check if docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        error "docker-compose is not installed"
    fi

    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "Scaled compose file not found: $COMPOSE_FILE"
    fi

    # Create staging directory
    mkdir -p "$STAGING_DIR"
    mkdir -p "$STAGING_DIR/backups"

    success "Pre-flight checks passed"
}

# Setup staging environment
setup_staging_env() {
    info "Setting up staging environment..."

    # Create staging environment file
    cat > "$ENV_FILE" << EOF
# ThaliumX Staging Environment
NODE_ENV=staging
ACTIVE_ENV=staging

# Database Configuration (Staging)
POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password
REDIS_PASSWORD_FILE=/run/secrets/redis-password
MONGODB_PASSWORD_FILE=/run/secrets/mongodb-password

# Authentication
AUTHENTIK_ADMIN_PASSWORD_FILE=/run/secrets/Authentik-admin-password
JWT_SECRET_FILE=/run/secrets/jwt-secret
ENCRYPTION_KEY_FILE=/run/secrets/encryption-key

# Monitoring
GRAFANA_ADMIN_PASSWORD_FILE=/run/secrets/grafana-admin-password

# Staging-specific settings
LOG_LEVEL=debug
ENABLE_DEBUG_ENDPOINTS=true
REDUCED_RATE_LIMITS=true

# Deployment metadata
DEPLOYMENT_TIMESTAMP=$(date +%s)
DEPLOYMENT_VERSION=staging-$(date +%Y%m%d-%H%M%S)
EOF

    # Create secrets directory structure
    mkdir -p "$STAGING_DIR/secrets"

    # Generate staging secrets (for testing only)
    echo "staging-postgres-password" > "$STAGING_DIR/secrets/postgres-password"
    echo "staging-redis-password" > "$STAGING_DIR/secrets/redis-password"
    echo "staging-mongodb-password" > "$STAGING_DIR/secrets/mongodb-password"
    echo "staging-Authentik-admin-password" > "$STAGING_DIR/secrets/Authentik-admin-password"
    echo "staging-jwt-secret-$(openssl rand -hex 32)" > "$STAGING_DIR/secrets/jwt-secret"
    echo "staging-encryption-key-$(openssl rand -hex 32)" > "$STAGING_DIR/secrets/encryption-key"
    echo "staging-grafana-admin-password" > "$STAGING_DIR/secrets/grafana-admin-password"

    success "Staging environment setup complete"
}

# Start staging deployment
start_staging() {
    info "Starting ThaliumX staging deployment..."

    # Change to deployment directory
    cd "$DEPLOYMENT_DIR"

    # Create backup before deployment
    create_backup

    # Set environment variables
    export COMPOSE_FILE="$COMPOSE_FILE"
    export ENV_FILE="$ENV_FILE"

    # Start services with scaled configuration
    info "Starting scaled services (this may take several minutes)..."
    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

    # Wait for services to be ready
    wait_for_services

    success "Staging deployment started successfully"
    show_access_info
}

# Stop staging deployment
stop_staging() {
    info "Stopping ThaliumX staging deployment..."

    cd "$DEPLOYMENT_DIR"

    export COMPOSE_FILE="$COMPOSE_FILE"
    export ENV_FILE="$ENV_FILE"

    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down

    success "Staging deployment stopped"
}

# Restart staging deployment
restart_staging() {
    info "Restarting ThaliumX staging deployment..."
    stop_staging
    sleep 10
    start_staging
}

# Show deployment status
show_status() {
    info "ThaliumX Staging Status"
    echo "========================"

    cd "$DEPLOYMENT_DIR"

    echo ""
    echo "Container Status:"
    docker ps --filter "label=com.docker.compose.project=thaliumx" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || echo "No containers running"

    echo ""
    echo "Service Health:"
    check_service_health "thaliumx-haproxy" && echo "✅ Load Balancer: Healthy" || echo "❌ Load Balancer: Unhealthy"
    check_service_health "thaliumx-backend-1" && echo "✅ Backend-1: Healthy" || echo "❌ Backend-1: Unhealthy"
    check_service_health "thaliumx-postgres-primary" && echo "✅ Database: Healthy" || echo "❌ Database: Unhealthy"
    check_service_health "thaliumx-kafka-1" && echo "✅ Kafka: Healthy" || echo "❌ Kafka: Unhealthy"

    echo ""
    echo "Resource Usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" thaliumx-haproxy thaliumx-backend-1 thaliumx-postgres-primary 2>/dev/null || echo "Unable to get resource stats"

    echo ""
    echo "Logs (last 10 lines):"
    echo "HAPROXY:"
    docker logs thaliumx-haproxy --tail 5 2>/dev/null || echo "No logs available"
    echo ""
    echo "BACKEND-1:"
    docker logs thaliumx-backend-1 --tail 5 2>/dev/null || echo "No logs available"
}

# Wait for services to be ready
wait_for_services() {
    local max_attempts=60
    local attempt=1

    info "Waiting for services to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if check_service_health "thaliumx-haproxy" &&
           check_service_health "thaliumx-backend-1" &&
           check_service_health "thaliumx-postgres-primary"; then
            success "All core services are healthy"
            return 0
        fi

        info "Waiting for services... (attempt $attempt/$max_attempts)"
        sleep 30
        ((attempt++))
    done

    error "Services failed to become healthy within $(($max_attempts * 30)) seconds"
}

# Check service health
check_service_health() {
    local service=$1
    docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"
}

# Create backup
create_backup() {
    info "Creating pre-deployment backup..."

    mkdir -p "$BACKUP_DIR"

    # Backup current container states
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" > "$BACKUP_DIR/containers.txt" 2>/dev/null || true

    # Backup configurations
    cp "$ENV_FILE" "$BACKUP_DIR/" 2>/dev/null || true

    success "Backup created at $BACKUP_DIR"
}

# Show access information
show_access_info() {
    echo ""
    echo "🎉 ThaliumX Staging Deployment Complete!"
    echo "========================================"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend:     http://localhost:3000"
    echo "   API:          http://localhost:3002"
    echo "   Load Balancer: http://localhost:80"
    echo "   Grafana:      http://localhost:3001"
    echo "   Authentik:     http://localhost:8080"
    echo ""
    echo "📊 Monitoring:"
    echo "   Prometheus:   http://localhost:9090"
    echo "   Jaeger:       http://localhost:16686"
    echo ""
    echo "🔧 Management:"
    echo "   View status:  ./deploy-staging.sh status"
    echo "   View logs:    docker logs thaliumx-backend-1"
    echo "   Stop staging: ./deploy-staging.sh stop"
    echo ""
    echo "🧪 Testing Commands:"
    echo "   Health check: curl http://localhost/health"
    echo "   API test:     curl http://localhost/api/health"
    echo "   Load test:    artillery run tests/load/load-test.yml"
    echo ""
    echo "⚠️  REMEMBER: This is staging environment for testing only!"
}

# Main execution
main() {
    local command=${1:-status}

    case $command in
        start)
            preflight_checks
            setup_staging_env
            start_staging
            ;;
        stop)
            stop_staging
            ;;
        restart)
            restart_staging
            ;;
        status)
            show_status
            ;;
        *)
            error "Usage: $0 [start|stop|restart|status]"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"