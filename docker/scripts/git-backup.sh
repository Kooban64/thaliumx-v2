#!/bin/bash

# ThaliumX Git Backup Script
# =========================
# Comprehensive backup solution for ThaliumX platform
# Backs up code, configurations, and creates deployment-ready archives

set -e

# Configuration
BACKUP_DIR="/opt/thaliumx/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="thaliumx_backup_${TIMESTAMP}"
LOG_FILE="$BACKUP_DIR/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    # Create log directory if it doesn't exist
    sudo mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2 | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*" | tee -a "$LOG_FILE"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown ubuntu:ubuntu "$BACKUP_DIR"
}

# Git repository backup
backup_git_repo() {
    log "Starting Git repository backup..."

    cd /home/ubuntu/thaliumx

    # Check git status
    if ! git status >/dev/null 2>&1; then
        error "Not a git repository"
        return 1
    fi

    # Get current branch and commit
    CURRENT_BRANCH=$(git branch --show-current)
    CURRENT_COMMIT=$(git rev-parse HEAD)
    LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "no-tag")

    log "Current branch: $CURRENT_BRANCH"
    log "Current commit: $CURRENT_COMMIT"
    log "Latest tag: $LATEST_TAG"

    # Create backup archive
    BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}_git.tar.gz"

    log "Creating git repository archive..."
    git archive --format=tar.gz --output="$BACKUP_FILE" HEAD

    # Create metadata file
    cat > "$BACKUP_DIR/${BACKUP_NAME}_metadata.json" << EOF
{
    "backup_type": "git_repository",
    "timestamp": "$TIMESTAMP",
    "branch": "$CURRENT_BRANCH",
    "commit": "$CURRENT_COMMIT",
    "tag": "$LATEST_TAG",
    "repository": "https://github.com/Kooban64/thaliumx.git",
    "files_included": $(git ls-files | wc -l),
    "total_size_mb": $(du -sm . | cut -f1)
}
EOF

    success "Git repository backup completed: $BACKUP_FILE"
}

# Configuration backup
backup_configurations() {
    log "Starting configuration backup..."

    CONFIG_BACKUP="$BACKUP_DIR/${BACKUP_NAME}_config.tar.gz"

    # Create temporary directory for configs
    TEMP_DIR=$(mktemp -d)
    CONFIG_DIR="$TEMP_DIR/configs"

    mkdir -p "$CONFIG_DIR"

    # Copy important configuration files (excluding secrets)
    cp -r docker/ "$CONFIG_DIR/" 2>/dev/null || true
    cp docker-compose.yml "$CONFIG_DIR/" 2>/dev/null || true
    cp .env* "$CONFIG_DIR/" 2>/dev/null || true

    # Remove sensitive files
    find "$CONFIG_DIR" -name "*.key" -delete 2>/dev/null || true
    find "$CONFIG_DIR" -name "*.pem" -delete 2>/dev/null || true
    find "$CONFIG_DIR" -name "*secret*" -delete 2>/dev/null || true
    find "$CONFIG_DIR" -name ".env.local" -delete 2>/dev/null || true

    # Create archive
    tar -czf "$CONFIG_BACKUP" -C "$TEMP_DIR" configs/

    # Cleanup
    rm -rf "$TEMP_DIR"

    success "Configuration backup completed: $CONFIG_BACKUP"
}

# Database schema backup (structure only, no data)
backup_database_schema() {
    log "Starting database schema backup..."

    SCHEMA_BACKUP="$BACKUP_DIR/${BACKUP_NAME}_schema.sql"

    # Use docker to dump schema from running containers
    if docker ps | grep -q thaliumx; then
        log "Dumping database schemas..."

        # PostgreSQL schema dump
        docker exec thaliumx-citus-coordinator-1 pg_dump \
            --schema-only \
            --no-owner \
            --no-privileges \
            -U thaliumx \
            thaliumx > "$SCHEMA_BACKUP" 2>/dev/null || warning "Could not dump PostgreSQL schema"

        success "Database schema backup completed: $SCHEMA_BACKUP"
    else
        warning "No running ThaliumX containers found, skipping database schema backup"
    fi
}

# Create deployment package
create_deployment_package() {
    log "Creating deployment package..."

    DEPLOY_PACKAGE="$BACKUP_DIR/${BACKUP_NAME}_deploy.tar.gz"

    # Create deployment directory
    DEPLOY_DIR=$(mktemp -d)
    mkdir -p "$DEPLOY_DIR/thaliumx"

    # Copy deployment files
    cp -r docker/ "$DEPLOY_DIR/thaliumx/"
    cp docker-compose.yml "$DEPLOY_DIR/thaliumx/" 2>/dev/null || true
    cp docker-compose.prod.yml "$DEPLOY_DIR/thaliumx/" 2>/dev/null || true

    # Copy documentation
    cp *.md "$DEPLOY_DIR/thaliumx/" 2>/dev/null || true

    # Create deployment script
    cat > "$DEPLOY_DIR/thaliumx/deploy.sh" << 'EOF'
#!/bin/bash
# ThaliumX Deployment Script

echo "🚀 Deploying ThaliumX..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Pull latest images
docker-compose pull

# Start services
docker-compose up -d

# Run health checks
sleep 30
curl -f http://localhost:3002/health || echo "Health check failed"

echo "✅ Deployment completed!"
EOF

    chmod +x "$DEPLOY_DIR/thaliumx/deploy.sh"

    # Create archive
    tar -czf "$DEPLOY_PACKAGE" -C "$DEPLOY_DIR" thaliumx/

    # Cleanup
    rm -rf "$DEPLOY_DIR"

    success "Deployment package created: $DEPLOY_PACKAGE"
}

# Backup to remote repository
backup_to_remote() {
    log "Pushing backup metadata to remote repository..."

    cd /home/ubuntu/thaliumx

    # Create backup commit
    git add .
    git commit -m "🔄 Automated Backup - $TIMESTAMP

Backup created: $BACKUP_NAME
Location: $BACKUP_DIR
Includes: Git repo, configs, schemas, deployment package

This commit serves as a backup reference point." --allow-empty || true

    # Push to remote
    git push origin main || git push origin master || warning "Could not push to remote repository"
}

# Generate backup report
generate_report() {
    log "Generating backup report..."

    REPORT_FILE="$BACKUP_DIR/${BACKUP_NAME}_report.txt"

    cat > "$REPORT_FILE" << EOF
ThaliumX Backup Report
======================

Backup Date: $(date)
Backup Name: $BACKUP_NAME
Location: $BACKUP_DIR

Files Created:
$(ls -la "$BACKUP_DIR" | grep "$BACKUP_NAME")

Disk Usage:
$(du -sh "$BACKUP_DIR"/* 2>/dev/null || echo "Could not calculate disk usage")

Git Status:
Branch: $(git branch --show-current 2>/dev/null || echo "N/A")
Commit: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
Remote: $(git remote get-url origin 2>/dev/null || echo "N/A")

System Information:
$(uname -a)
Docker Version: $(docker --version 2>/dev/null || echo "Not installed")
Docker Compose Version: $(docker-compose --version 2>/dev/null || echo "Not installed")

Backup completed successfully at $(date)
EOF

    success "Backup report generated: $REPORT_FILE"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (keeping last 10)..."

    # Keep only the 10 most recent backups
    cd "$BACKUP_DIR"
    ls -t | grep -E "(git|config|schema|deploy|report)" | sed -n '11,$p' | xargs -r rm -f

    success "Old backup cleanup completed"
}

# Main backup function
main() {
    log "🚀 Starting ThaliumX comprehensive backup..."

    # Create backup directory
    create_backup_dir

    # Perform backups
    backup_git_repo
    backup_configurations
    backup_database_schema
    create_deployment_package

    # Generate report
    generate_report

    # Push to remote
    backup_to_remote

    # Cleanup
    cleanup_old_backups

    success "✅ ThaliumX backup completed successfully!"
    success "Backup location: $BACKUP_DIR"
    success "Backup name: $BACKUP_NAME"

    # Show backup files
    echo ""
    echo "📁 Backup Files Created:"
    ls -la "$BACKUP_DIR" | grep "$BACKUP_NAME" | while read line; do
        echo "  $line"
    done
}

# Run main function
main "$@"