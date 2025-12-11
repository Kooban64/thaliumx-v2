#!/bin/bash

# ThaliumX Blue-Green Deployment Script
# ====================================
# Zero-downtime deployment with automatic rollback capability
#
# Usage:
#   ./blue-green-deploy.sh [deploy|rollback|status]
#
# Environment Variables:
#   BLUE_TAG: Docker tag for blue environment
#   GREEN_TAG: Docker tag for green environment
#   ACTIVE_ENV: Currently active environment (blue/green)

set -euo pipefail

# Configuration
DEPLOYMENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLUE_COMPOSE_FILE="$DEPLOYMENT_DIR/docker/docker-compose.blue.yaml"
GREEN_COMPOSE_FILE="$DEPLOYMENT_DIR/docker/docker-compose.green.yaml"
BACKUP_DIR="$DEPLOYMENT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$DEPLOYMENT_DIR/logs/blue-green-deploy-$(date +%Y%m%d).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    log "ERROR: $1"
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

# Health check functions
check_service_health() {
    local service=$1
    local max_attempts=30
    local attempt=1

    info "Checking health of $service..."

    while [ $attempt -le $max_attempts ]; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
            if curl -f -s "http://localhost:$(get_service_port $service)/health" > /dev/null 2>&1; then
                success "$service is healthy"
                return 0
            fi
        fi

        info "Waiting for $service to be healthy (attempt $attempt/$max_attempts)..."
        sleep 10
        ((attempt++))
    done

    error "$service failed health check after $max_attempts attempts"
    return 1
}

get_service_port() {
    local service=$1
    case $service in
        "thaliumx-haproxy")
            echo "80"
            ;;
        "thaliumx-backend-blue"|"thaliumx-backend-green")
            echo "3002"
            ;;
        "thaliumx-frontend-blue"|"thaliumx-frontend-green")
            echo "3000"
            ;;
        *)
            echo "8080"
            ;;
    esac
}

# Deployment functions
deploy_blue() {
    info "Starting blue environment deployment..."

    # Create backup
    create_backup

    # Update blue environment
    update_environment "blue"

    # Start blue services
    info "Starting blue environment services..."
    docker-compose -f "$BLUE_COMPOSE_FILE" up -d

    # Wait for services to be healthy
    if check_service_health "thaliumx-backend-blue" &&
       check_service_health "thaliumx-frontend-blue"; then

        # Switch traffic to blue
        switch_traffic "blue"

        # Stop green environment
        info "Stopping green environment..."
        docker-compose -f "$GREEN_COMPOSE_FILE" down

        success "Blue environment deployment completed successfully"
        update_active_environment "blue"
    else
        error "Blue environment health check failed"
        rollback_to_green
        exit 1
    fi
}

deploy_green() {
    info "Starting green environment deployment..."

    # Create backup
    create_backup

    # Update green environment
    update_environment "green"

    # Start green services
    info "Starting green environment services..."
    docker-compose -f "$GREEN_COMPOSE_FILE" up -d

    # Wait for services to be healthy
    if check_service_health "thaliumx-backend-green" &&
       check_service_health "thaliumx-frontend-green"; then

        # Switch traffic to green
        switch_traffic "green"

        # Stop blue environment
        info "Stopping blue environment..."
        docker-compose -f "$BLUE_COMPOSE_FILE" down

        success "Green environment deployment completed successfully"
        update_active_environment "green"
    else
        error "Green environment health check failed"
        rollback_to_blue
        exit 1
    fi
}

switch_traffic() {
    local target_env=$1
    info "Switching traffic to $target_env environment..."

    # Update HAProxy configuration
    update_haproxy_config "$target_env"

    # Reload HAProxy
    docker kill -s HUP thaliumx-haproxy

    # Wait for traffic switch to complete
    sleep 30

    # Verify traffic switch
    if verify_traffic_switch "$target_env"; then
        success "Traffic successfully switched to $target_env"
    else
        error "Traffic switch verification failed"
        return 1
    fi
}

update_environment() {
    local env=$1
    info "Updating $env environment configuration..."

    # Pull latest images
    if [ -n "${BLUE_TAG:-}" ] && [ "$env" = "blue" ]; then
        export BACKEND_IMAGE_TAG="$BLUE_TAG"
        export FRONTEND_IMAGE_TAG="$BLUE_TAG"
    elif [ -n "${GREEN_TAG:-}" ] && [ "$env" = "green" ]; then
        export BACKEND_IMAGE_TAG="$GREEN_TAG"
        export FRONTEND_IMAGE_TAG="$GREEN_TAG"
    fi

    # Update environment variables
    update_env_file "$env"
}

update_env_file() {
    local env=$1
    local env_file="$DEPLOYMENT_DIR/.env.$env"

    cat > "$env_file" << EOF
# $env Environment Configuration
NODE_ENV=production
ACTIVE_ENV=$env
BACKEND_IMAGE_TAG=\${BACKEND_IMAGE_TAG:-latest}
FRONTEND_IMAGE_TAG=\${FRONTEND_IMAGE_TAG:-latest}

# Database Configuration
POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password
REDIS_PASSWORD_FILE=/run/secrets/redis-password
MONGODB_PASSWORD_FILE=/run/secrets/mongodb-password

# Authentication
KEYCLOAK_ADMIN_PASSWORD_FILE=/run/secrets/keycloak-admin-password
JWT_SECRET_FILE=/run/secrets/jwt-secret
ENCRYPTION_KEY_FILE=/run/secrets/encryption-key

# Monitoring
GRAFANA_ADMIN_PASSWORD_FILE=/run/secrets/grafana-admin-password

# Deployment metadata
DEPLOYMENT_TIMESTAMP=$(date +%s)
DEPLOYMENT_VERSION=\${BACKEND_IMAGE_TAG}
EOF
}

update_haproxy_config() {
    local active_env=$1
    local haproxy_cfg="$DEPLOYMENT_DIR/docker/haproxy/haproxy.cfg"

    # Update backend references in HAProxy config
    if [ "$active_env" = "blue" ]; then
        sed -i 's/backend-green/backend-blue/g' "$haproxy_cfg"
    else
        sed -i 's/backend-blue/backend-green/g' "$haproxy_cfg"
    fi
}

verify_traffic_switch() {
    local target_env=$1
    local max_attempts=10
    local attempt=1

    info "Verifying traffic switch to $target_env..."

    while [ $attempt -le $max_attempts ]; do
        # Check if target environment is receiving traffic
        local active_backends
        active_backends=$(curl -s http://localhost:8404/stats | grep "backend-$target_env" | wc -l)

        if [ "$active_backends" -gt 0 ]; then
            success "Traffic switch verified - $target_env is active"
            return 0
        fi

        info "Waiting for traffic switch verification (attempt $attempt/$max_attempts)..."
        sleep 5
        ((attempt++))
    done

    error "Traffic switch verification failed"
    return 1
}

create_backup() {
    info "Creating pre-deployment backup..."

    mkdir -p "$BACKUP_DIR"

    # Backup current environment state
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" > "$BACKUP_DIR/containers.txt"
    docker stats --no-stream > "$BACKUP_DIR/stats.txt"

    # Backup configurations
    cp "$DEPLOYMENT_DIR/.env" "$BACKUP_DIR/" 2>/dev/null || true
    cp -r "$DEPLOYMENT_DIR/docker/" "$BACKUP_DIR/docker/" 2>/dev/null || true

    success "Backup created at $BACKUP_DIR"
}

rollback_to_blue() {
    warning "Rolling back to blue environment..."
    switch_traffic "blue"
    docker-compose -f "$GREEN_COMPOSE_FILE" down
    update_active_environment "blue"
}

rollback_to_green() {
    warning "Rolling back to green environment..."
    switch_traffic "green"
    docker-compose -f "$BLUE_COMPOSE_FILE" down
    update_active_environment "green"
}

update_active_environment() {
    local env=$1
    echo "$env" > "$DEPLOYMENT_DIR/.active_env"
    export ACTIVE_ENV="$env"
}

get_active_environment() {
    if [ -f "$DEPLOYMENT_DIR/.active_env" ]; then
        cat "$DEPLOYMENT_DIR/.active_env"
    else
        echo "blue"  # Default to blue
    fi
}

show_status() {
    local active_env
    active_env=$(get_active_environment)

    echo "=== Blue-Green Deployment Status ==="
    echo "Active Environment: $active_env"
    echo "Deployment Directory: $DEPLOYMENT_DIR"
    echo ""
    echo "Container Status:"
    docker ps --filter "name=thaliumx" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "Recent Deployments:"
    ls -la "$DEPLOYMENT_DIR/logs/blue-green-deploy-"* 2>/dev/null | head -5 || echo "No deployment logs found"
}

# Main deployment logic
main() {
    local command=${1:-status}

    case $command in
        deploy)
            local target_env=${2:-}
            if [ -z "$target_env" ]; then
                error "Please specify target environment: blue or green"
                exit 1
            fi

            if [ "$target_env" = "blue" ]; then
                deploy_blue
            elif [ "$target_env" = "green" ]; then
                deploy_green
            else
                error "Invalid environment: $target_env. Use 'blue' or 'green'"
                exit 1
            fi
            ;;
        rollback)
            local active_env
            active_env=$(get_active_environment)
            if [ "$active_env" = "blue" ]; then
                rollback_to_green
            else
                rollback_to_blue
            fi
            ;;
        status)
            show_status
            ;;
        *)
            error "Usage: $0 [deploy <blue|green>|rollback|status]"
            exit 1
            ;;
    esac
}

# Pre-flight checks
preflight_checks() {
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running"
        exit 1
    fi

    # Check if docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        error "docker-compose is not installed"
        exit 1
    fi

    # Check if required files exist
    if [ ! -f "$BLUE_COMPOSE_FILE" ]; then
        error "Blue compose file not found: $BLUE_COMPOSE_FILE"
        exit 1
    fi

    if [ ! -f "$GREEN_COMPOSE_FILE" ]; then
        error "Green compose file not found: $GREEN_COMPOSE_FILE"
        exit 1
    fi

    # Create log directory
    mkdir -p "$DEPLOYMENT_DIR/logs"
}

# Run pre-flight checks
preflight_checks

# Execute main function
main "$@"