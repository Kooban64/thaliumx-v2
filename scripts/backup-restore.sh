#!/bin/bash
# ThaliumX Database Backup and Restore Script
# ============================================
# Supports PostgreSQL (Citus), MongoDB, and Redis

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-thaliumx-citus-coordinator}"
MONGO_CONTAINER="${MONGO_CONTAINER:-thaliumx-mongodb}"
REDIS_CONTAINER="${REDIS_CONTAINER:-thaliumx-redis}"

# Load environment variables
if [ -f "docker/.env" ]; then
    source docker/.env
fi

# Default credentials (override with environment variables)
POSTGRES_USER="${POSTGRES_USER:-thaliumx}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ThaliumX2025}"
POSTGRES_DB="${POSTGRES_DB:-thaliumx}"
MONGO_USER="${MONGO_INITDB_ROOT_USERNAME:-admin}"
MONGO_PASSWORD="${MONGO_INITDB_ROOT_PASSWORD:-ThaliumX2025}"
REDIS_PASSWORD="${REDIS_PASSWORD:-ThaliumX2025}"

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    print_success "Backup directory: $BACKUP_DIR"
}

# Backup PostgreSQL (Citus)
backup_postgres() {
    print_header "Backing up PostgreSQL (Citus)"
    
    local backup_file="$BACKUP_DIR/postgres_${TIMESTAMP}.sql.gz"
    
    echo "Creating PostgreSQL backup..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl | gzip > "$backup_file"
    
    if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        print_success "PostgreSQL backup created: $backup_file ($size)"
    else
        print_error "PostgreSQL backup failed"
        return 1
    fi
}

# Backup MongoDB
backup_mongo() {
    print_header "Backing up MongoDB"
    
    local backup_dir="$BACKUP_DIR/mongo_${TIMESTAMP}"
    
    echo "Creating MongoDB backup..."
    docker exec "$MONGO_CONTAINER" \
        mongodump --username "$MONGO_USER" --password "$MONGO_PASSWORD" \
        --authenticationDatabase admin --out /tmp/mongodump
    
    docker cp "$MONGO_CONTAINER:/tmp/mongodump" "$backup_dir"
    docker exec "$MONGO_CONTAINER" rm -rf /tmp/mongodump
    
    # Compress the backup
    tar -czf "${backup_dir}.tar.gz" -C "$BACKUP_DIR" "mongo_${TIMESTAMP}"
    rm -rf "$backup_dir"
    
    if [ -f "${backup_dir}.tar.gz" ]; then
        local size=$(du -h "${backup_dir}.tar.gz" | cut -f1)
        print_success "MongoDB backup created: ${backup_dir}.tar.gz ($size)"
    else
        print_error "MongoDB backup failed"
        return 1
    fi
}

# Backup Redis
backup_redis() {
    print_header "Backing up Redis"
    
    local backup_file="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
    
    echo "Creating Redis backup..."
    # Trigger BGSAVE
    docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" BGSAVE 2>/dev/null || true
    sleep 2
    
    # Copy the dump file
    docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$backup_file" 2>/dev/null || {
        print_warning "Redis dump.rdb not found, creating new snapshot..."
        docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" SAVE 2>/dev/null || true
        docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$backup_file" 2>/dev/null || {
            print_warning "Redis backup skipped (no data or AOF mode)"
            return 0
        }
    }
    
    if [ -f "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        print_success "Redis backup created: $backup_file ($size)"
    fi
}

# Full backup
backup_all() {
    print_header "ThaliumX Full Database Backup"
    echo "Timestamp: $TIMESTAMP"
    echo ""
    
    create_backup_dir
    
    backup_postgres
    backup_mongo
    backup_redis
    
    echo ""
    print_header "Backup Summary"
    echo "Backup location: $BACKUP_DIR"
    ls -lh "$BACKUP_DIR"/*_${TIMESTAMP}* 2>/dev/null || echo "No backups found"
    
    # Create manifest
    cat > "$BACKUP_DIR/manifest_${TIMESTAMP}.json" << EOF
{
    "timestamp": "$TIMESTAMP",
    "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "backups": {
        "postgres": "postgres_${TIMESTAMP}.sql.gz",
        "mongo": "mongo_${TIMESTAMP}.tar.gz",
        "redis": "redis_${TIMESTAMP}.rdb"
    },
    "version": "1.0.0"
}
EOF
    print_success "Manifest created: $BACKUP_DIR/manifest_${TIMESTAMP}.json"
}

# Restore PostgreSQL
restore_postgres() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        print_error "Usage: $0 restore-postgres <backup_file.sql.gz>"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    print_header "Restoring PostgreSQL from $backup_file"
    print_warning "This will overwrite existing data!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled"
        return 0
    fi
    
    echo "Restoring PostgreSQL..."
    gunzip -c "$backup_file" | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
        psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
    
    print_success "PostgreSQL restored from $backup_file"
}

# Restore MongoDB
restore_mongo() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        print_error "Usage: $0 restore-mongo <backup_file.tar.gz>"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    print_header "Restoring MongoDB from $backup_file"
    print_warning "This will overwrite existing data!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled"
        return 0
    fi
    
    echo "Restoring MongoDB..."
    local temp_dir=$(mktemp -d)
    tar -xzf "$backup_file" -C "$temp_dir"
    
    local dump_dir=$(find "$temp_dir" -type d -name "mongo_*" | head -1)
    docker cp "$dump_dir" "$MONGO_CONTAINER:/tmp/mongorestore"
    
    docker exec "$MONGO_CONTAINER" \
        mongorestore --username "$MONGO_USER" --password "$MONGO_PASSWORD" \
        --authenticationDatabase admin --drop /tmp/mongorestore
    
    docker exec "$MONGO_CONTAINER" rm -rf /tmp/mongorestore
    rm -rf "$temp_dir"
    
    print_success "MongoDB restored from $backup_file"
}

# Restore Redis
restore_redis() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        print_error "Usage: $0 restore-redis <backup_file.rdb>"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    print_header "Restoring Redis from $backup_file"
    print_warning "This will overwrite existing data and restart Redis!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled"
        return 0
    fi
    
    echo "Restoring Redis..."
    docker cp "$backup_file" "$REDIS_CONTAINER:/data/dump.rdb"
    docker restart "$REDIS_CONTAINER"
    
    print_success "Redis restored from $backup_file"
}

# List backups
list_backups() {
    print_header "Available Backups"
    
    if [ -d "$BACKUP_DIR" ]; then
        echo "Location: $BACKUP_DIR"
        echo ""
        ls -lht "$BACKUP_DIR" 2>/dev/null || echo "No backups found"
    else
        echo "Backup directory not found: $BACKUP_DIR"
    fi
}

# Cleanup old backups
cleanup_backups() {
    local days="${1:-7}"
    
    print_header "Cleaning up backups older than $days days"
    
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -type f -mtime +$days -delete
        print_success "Cleanup complete"
    else
        echo "Backup directory not found: $BACKUP_DIR"
    fi
}

# Test backup integrity
test_backup() {
    print_header "Testing Backup Integrity"
    
    local latest_postgres=$(ls -t "$BACKUP_DIR"/postgres_*.sql.gz 2>/dev/null | head -1)
    local latest_mongo=$(ls -t "$BACKUP_DIR"/mongo_*.tar.gz 2>/dev/null | head -1)
    local latest_redis=$(ls -t "$BACKUP_DIR"/redis_*.rdb 2>/dev/null | head -1)
    
    echo "Testing PostgreSQL backup..."
    if [ -f "$latest_postgres" ]; then
        if gunzip -t "$latest_postgres" 2>/dev/null; then
            print_success "PostgreSQL backup is valid: $latest_postgres"
        else
            print_error "PostgreSQL backup is corrupted: $latest_postgres"
        fi
    else
        print_warning "No PostgreSQL backup found"
    fi
    
    echo "Testing MongoDB backup..."
    if [ -f "$latest_mongo" ]; then
        if tar -tzf "$latest_mongo" >/dev/null 2>&1; then
            print_success "MongoDB backup is valid: $latest_mongo"
        else
            print_error "MongoDB backup is corrupted: $latest_mongo"
        fi
    else
        print_warning "No MongoDB backup found"
    fi
    
    echo "Testing Redis backup..."
    if [ -f "$latest_redis" ]; then
        if file "$latest_redis" | grep -q "Redis"; then
            print_success "Redis backup is valid: $latest_redis"
        else
            print_warning "Redis backup format unknown: $latest_redis"
        fi
    else
        print_warning "No Redis backup found"
    fi
}

# Show usage
usage() {
    echo "ThaliumX Database Backup and Restore Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  backup              Create full backup of all databases"
    echo "  backup-postgres     Backup PostgreSQL only"
    echo "  backup-mongo        Backup MongoDB only"
    echo "  backup-redis        Backup Redis only"
    echo "  restore-postgres    Restore PostgreSQL from backup"
    echo "  restore-mongo       Restore MongoDB from backup"
    echo "  restore-redis       Restore Redis from backup"
    echo "  list                List available backups"
    echo "  test                Test backup integrity"
    echo "  cleanup [days]      Remove backups older than N days (default: 7)"
    echo ""
    echo "Environment variables:"
    echo "  BACKUP_DIR          Backup directory (default: ./backups)"
    echo "  POSTGRES_CONTAINER  PostgreSQL container name"
    echo "  MONGO_CONTAINER     MongoDB container name"
    echo "  REDIS_CONTAINER     Redis container name"
}

# Main
case "${1:-}" in
    backup)
        backup_all
        ;;
    backup-postgres)
        create_backup_dir
        backup_postgres
        ;;
    backup-mongo)
        create_backup_dir
        backup_mongo
        ;;
    backup-redis)
        create_backup_dir
        backup_redis
        ;;
    restore-postgres)
        restore_postgres "$2"
        ;;
    restore-mongo)
        restore_mongo "$2"
        ;;
    restore-redis)
        restore_redis "$2"
        ;;
    list)
        list_backups
        ;;
    test)
        test_backup
        ;;
    cleanup)
        cleanup_backups "${2:-7}"
        ;;
    *)
        usage
        ;;
esac