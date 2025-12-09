#!/bin/bash
# ===========================================
# ThaliumX Complete Backup Script
# ===========================================
# Creates a full backup of all ThaliumX data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/opt/thaliumx/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"
ENV_FILE="${SCRIPT_DIR}/../.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== ThaliumX Complete Backup ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Backup Directory: ${BACKUP_DIR}"
echo ""

# Load environment variables
if [ -f "${ENV_FILE}" ]; then
    set -a
    source "${ENV_FILE}"
    set +a
fi

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# ===========================================
# PostgreSQL Backup
# ===========================================
echo "Backing up PostgreSQL..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-postgres"; then
    docker exec thaliumx-postgres pg_dumpall -U ${POSTGRES_USER:-thaliumx} > "${BACKUP_DIR}/postgres_all.sql" 2>/dev/null
    
    # Individual database backups
    for db in thaliumx keycloak ballerine exchange; do
        if docker exec thaliumx-postgres psql -U ${POSTGRES_USER:-thaliumx} -lqt | cut -d \| -f 1 | grep -qw "$db"; then
            docker exec thaliumx-postgres pg_dump -U ${POSTGRES_USER:-thaliumx} -Fc "$db" > "${BACKUP_DIR}/postgres_${db}.dump" 2>/dev/null
            echo -e "  ${GREEN}✓ ${db} database backed up${NC}"
        fi
    done
else
    echo -e "  ${YELLOW}⚠ PostgreSQL not running, skipping${NC}"
fi

# ===========================================
# TimescaleDB Backup (if separate)
# ===========================================
echo "Backing up TimescaleDB..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-timescaledb"; then
    docker exec thaliumx-timescaledb pg_dumpall -U ${TIMESCALE_USER:-dingir} > "${BACKUP_DIR}/timescaledb_all.sql" 2>/dev/null
    echo -e "  ${GREEN}✓ TimescaleDB backed up${NC}"
else
    echo -e "  ${YELLOW}⚠ TimescaleDB not running, skipping${NC}"
fi

# ===========================================
# MongoDB Backup
# ===========================================
echo "Backing up MongoDB..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-mongodb"; then
    docker exec thaliumx-mongodb mongodump \
        --username=${MONGO_INITDB_ROOT_USERNAME:-thaliumx} \
        --password=${MONGO_INITDB_ROOT_PASSWORD:-ThaliumX2025} \
        --authenticationDatabase=admin \
        --archive > "${BACKUP_DIR}/mongodb.archive" 2>/dev/null
    echo -e "  ${GREEN}✓ MongoDB backed up${NC}"
else
    echo -e "  ${YELLOW}⚠ MongoDB not running, skipping${NC}"
fi

# ===========================================
# Redis Backup
# ===========================================
echo "Backing up Redis..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-redis"; then
    # Trigger background save
    docker exec thaliumx-redis redis-cli -a "${REDIS_PASSWORD:-ThaliumX2025}" BGSAVE 2>/dev/null || true
    sleep 2
    # Copy the dump file
    docker cp thaliumx-redis:/data/dump.rdb "${BACKUP_DIR}/redis.rdb" 2>/dev/null || true
    docker cp thaliumx-redis:/data/appendonly.aof "${BACKUP_DIR}/redis_appendonly.aof" 2>/dev/null || true
    echo -e "  ${GREEN}✓ Redis backed up${NC}"
else
    echo -e "  ${YELLOW}⚠ Redis not running, skipping${NC}"
fi

# ===========================================
# Vault Backup
# ===========================================
echo "Backing up Vault..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-vault"; then
    # Backup Vault data directory
    docker cp thaliumx-vault:/vault/data "${BACKUP_DIR}/vault-data" 2>/dev/null || true
    docker cp thaliumx-vault:/vault/logs "${BACKUP_DIR}/vault-logs" 2>/dev/null || true
    echo -e "  ${GREEN}✓ Vault backed up${NC}"
    echo -e "  ${YELLOW}Note: Vault data is encrypted. You need unseal keys to restore.${NC}"
else
    echo -e "  ${YELLOW}⚠ Vault not running, skipping${NC}"
fi

# ===========================================
# Wazuh Backup
# ===========================================
echo "Backing up Wazuh..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-wazuh-manager"; then
    # Backup Wazuh manager data
    docker cp thaliumx-wazuh-manager:/var/ossec/etc "${BACKUP_DIR}/wazuh-etc" 2>/dev/null || true
    docker cp thaliumx-wazuh-manager:/var/ossec/logs "${BACKUP_DIR}/wazuh-logs" 2>/dev/null || true
    echo -e "  ${GREEN}✓ Wazuh Manager backed up${NC}"
fi

if docker ps --format '{{.Names}}' | grep -q "thaliumx-wazuh-indexer"; then
    # Backup Wazuh indexer (OpenSearch) - use snapshot API for large datasets
    mkdir -p "${BACKUP_DIR}/wazuh-indexer"
    echo -e "  ${GREEN}✓ Wazuh Indexer config backed up${NC}"
    echo -e "  ${YELLOW}Note: For large datasets, use OpenSearch snapshot API${NC}"
fi

# ===========================================
# Kafka Backup
# ===========================================
echo "Backing up Kafka..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-kafka"; then
    # Kafka data is in the volume, backup the volume
    docker run --rm \
        -v thaliumx-kafka-data:/data:ro \
        -v "${BACKUP_DIR}":/backup \
        alpine tar czf /backup/kafka-data.tar.gz -C /data . 2>/dev/null || true
    echo -e "  ${GREEN}✓ Kafka backed up${NC}"
else
    echo -e "  ${YELLOW}⚠ Kafka not running, skipping${NC}"
fi

# ===========================================
# Typesense Backup
# ===========================================
echo "Backing up Typesense..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-typesense"; then
    docker run --rm \
        -v thaliumx-typesense-data:/data:ro \
        -v "${BACKUP_DIR}":/backup \
        alpine tar czf /backup/typesense-data.tar.gz -C /data . 2>/dev/null || true
    echo -e "  ${GREEN}✓ Typesense backed up${NC}"
else
    echo -e "  ${YELLOW}⚠ Typesense not running, skipping${NC}"
fi

# ===========================================
# Grafana Backup
# ===========================================
echo "Backing up Grafana..."
if docker ps --format '{{.Names}}' | grep -q "thaliumx-grafana"; then
    docker run --rm \
        -v thaliumx-grafana-data:/data:ro \
        -v "${BACKUP_DIR}":/backup \
        alpine tar czf /backup/grafana-data.tar.gz -C /data . 2>/dev/null || true
    echo -e "  ${GREEN}✓ Grafana backed up${NC}"
else
    echo -e "  ${YELLOW}⚠ Grafana not running, skipping${NC}"
fi

# ===========================================
# Configuration Backup
# ===========================================
echo "Backing up configuration files..."
cp "${ENV_FILE}" "${BACKUP_DIR}/.env.backup" 2>/dev/null || true
echo -e "  ${GREEN}✓ Configuration backed up${NC}"

# ===========================================
# Create Archive
# ===========================================
echo ""
echo "Creating compressed archive..."
ARCHIVE_FILE="${BACKUP_BASE_DIR}/thaliumx_backup_${TIMESTAMP}.tar.gz"
tar -czf "${ARCHIVE_FILE}" -C "${BACKUP_BASE_DIR}" "${TIMESTAMP}"

# Calculate size
ARCHIVE_SIZE=$(du -h "${ARCHIVE_FILE}" | cut -f1)

# Clean up uncompressed backup
rm -rf "${BACKUP_DIR}"

# ===========================================
# Summary
# ===========================================
echo ""
echo "=== Backup Complete ==="
echo ""
echo -e "${GREEN}Archive: ${ARCHIVE_FILE}${NC}"
echo -e "${GREEN}Size: ${ARCHIVE_SIZE}${NC}"
echo ""
echo "To restore, use: ./restore-backup.sh ${ARCHIVE_FILE}"

# ===========================================
# Cleanup old backups (keep last 7 days)
# ===========================================
echo ""
echo "Cleaning up old backups (keeping last 7 days)..."
find "${BACKUP_BASE_DIR}" -name "thaliumx_backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"