#!/bin/bash
# ===========================================
# ThaliumX Backup Restore Script
# ===========================================
# Restores a ThaliumX backup from archive

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_archive.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -la /opt/thaliumx/backups/*.tar.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

ARCHIVE_FILE="$1"

if [ ! -f "${ARCHIVE_FILE}" ]; then
    echo -e "${RED}Error: Backup file not found: ${ARCHIVE_FILE}${NC}"
    exit 1
fi

echo "=== ThaliumX Backup Restore ==="
echo "Archive: ${ARCHIVE_FILE}"
echo ""

# Load environment variables
if [ -f "${ENV_FILE}" ]; then
    set -a
    source "${ENV_FILE}"
    set +a
fi

# Create temp directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

echo "Extracting backup..."
tar -xzf "${ARCHIVE_FILE}" -C "${TEMP_DIR}"

# Find the backup directory (it's the timestamp folder)
BACKUP_DIR=$(find "${TEMP_DIR}" -mindepth 1 -maxdepth 1 -type d | head -1)

if [ -z "${BACKUP_DIR}" ]; then
    echo -e "${RED}Error: Invalid backup archive structure${NC}"
    exit 1
fi

echo "Backup directory: ${BACKUP_DIR}"
echo ""

# ===========================================
# Confirmation
# ===========================================
echo -e "${YELLOW}WARNING: This will overwrite existing data!${NC}"
echo ""
read -p "Are you sure you want to restore? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# ===========================================
# Stop services that will be restored
# ===========================================
echo ""
echo "Stopping services..."
cd "${SCRIPT_DIR}/.."
docker compose stop keycloak ballerine-api ballerine-worker 2>/dev/null || true

# ===========================================
# PostgreSQL Restore
# ===========================================
echo ""
echo "Restoring PostgreSQL..."
if [ -f "${BACKUP_DIR}/postgres_all.sql" ]; then
    if docker ps --format '{{.Names}}' | grep -q "thaliumx-postgres"; then
        # Restore full dump
        docker exec -i thaliumx-postgres psql -U ${POSTGRES_USER:-thaliumx} < "${BACKUP_DIR}/postgres_all.sql" 2>/dev/null || true
        echo -e "  ${GREEN}✓ PostgreSQL restored from full dump${NC}"
    else
        echo -e "  ${YELLOW}⚠ PostgreSQL not running${NC}"
    fi
elif ls "${BACKUP_DIR}"/postgres_*.dump 1>/dev/null 2>&1; then
    # Restore individual databases
    for dump_file in "${BACKUP_DIR}"/postgres_*.dump; do
        db_name=$(basename "$dump_file" .dump | sed 's/postgres_//')
        if docker ps --format '{{.Names}}' | grep -q "thaliumx-postgres"; then
            docker exec -i thaliumx-postgres pg_restore -U ${POSTGRES_USER:-thaliumx} -d "$db_name" -c < "$dump_file" 2>/dev/null || true
            echo -e "  ${GREEN}✓ ${db_name} database restored${NC}"
        fi
    done
else
    echo -e "  ${YELLOW}⚠ No PostgreSQL backup found${NC}"
fi

# ===========================================
# TimescaleDB Restore
# ===========================================
echo ""
echo "Restoring TimescaleDB..."
if [ -f "${BACKUP_DIR}/timescaledb_all.sql" ]; then
    if docker ps --format '{{.Names}}' | grep -q "thaliumx-timescaledb"; then
        docker exec -i thaliumx-timescaledb psql -U ${TIMESCALE_USER:-dingir} < "${BACKUP_DIR}/timescaledb_all.sql" 2>/dev/null || true
        echo -e "  ${GREEN}✓ TimescaleDB restored${NC}"
    else
        echo -e "  ${YELLOW}⚠ TimescaleDB not running${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ No TimescaleDB backup found${NC}"
fi

# ===========================================
# MongoDB Restore
# ===========================================
echo ""
echo "Restoring MongoDB..."
if [ -f "${BACKUP_DIR}/mongodb.archive" ]; then
    if docker ps --format '{{.Names}}' | grep -q "thaliumx-mongodb"; then
        docker exec -i thaliumx-mongodb mongorestore \
            --username=${MONGO_INITDB_ROOT_USERNAME:-thaliumx} \
            --password=${MONGO_INITDB_ROOT_PASSWORD:-ThaliumX2025} \
            --authenticationDatabase=admin \
            --archive --drop < "${BACKUP_DIR}/mongodb.archive" 2>/dev/null || true
        echo -e "  ${GREEN}✓ MongoDB restored${NC}"
    else
        echo -e "  ${YELLOW}⚠ MongoDB not running${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ No MongoDB backup found${NC}"
fi

# ===========================================
# Redis Restore
# ===========================================
echo ""
echo "Restoring Redis..."
if [ -f "${BACKUP_DIR}/redis.rdb" ]; then
    if docker ps --format '{{.Names}}' | grep -q "thaliumx-redis"; then
        # Stop Redis, copy dump, restart
        docker stop thaliumx-redis 2>/dev/null || true
        docker cp "${BACKUP_DIR}/redis.rdb" thaliumx-redis:/data/dump.rdb 2>/dev/null || true
        docker start thaliumx-redis 2>/dev/null || true
        echo -e "  ${GREEN}✓ Redis restored${NC}"
    else
        echo -e "  ${YELLOW}⚠ Redis not running${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ No Redis backup found${NC}"
fi

# ===========================================
# Vault Restore
# ===========================================
echo ""
echo "Restoring Vault..."
if [ -d "${BACKUP_DIR}/vault-data" ]; then
    echo -e "  ${YELLOW}⚠ Vault data restore requires manual intervention${NC}"
    echo "  To restore Vault:"
    echo "    1. Stop Vault: docker stop thaliumx-vault"
    echo "    2. Remove existing data: docker volume rm thaliumx-vault-data"
    echo "    3. Create new volume and copy data"
    echo "    4. Start Vault and unseal with original keys"
else
    echo -e "  ${YELLOW}⚠ No Vault backup found${NC}"
fi

# ===========================================
# Kafka Restore
# ===========================================
echo ""
echo "Restoring Kafka..."
if [ -f "${BACKUP_DIR}/kafka-data.tar.gz" ]; then
    echo -e "  ${YELLOW}⚠ Kafka data restore requires service restart${NC}"
    echo "  To restore Kafka:"
    echo "    1. Stop Kafka: docker stop thaliumx-kafka"
    echo "    2. Restore volume from backup"
    echo "    3. Start Kafka"
else
    echo -e "  ${YELLOW}⚠ No Kafka backup found${NC}"
fi

# ===========================================
# Restart Services
# ===========================================
echo ""
echo "Restarting services..."
docker compose start keycloak ballerine-api ballerine-worker 2>/dev/null || true

# ===========================================
# Summary
# ===========================================
echo ""
echo "=== Restore Complete ==="
echo ""
echo "Restored components:"
echo "  - PostgreSQL databases"
echo "  - MongoDB"
echo "  - Redis"
echo ""
echo -e "${YELLOW}Manual steps may be required for:${NC}"
echo "  - Vault (requires unseal keys)"
echo "  - Kafka (requires service restart)"
echo ""
echo "Verify services are healthy:"
echo "  docker compose ps"