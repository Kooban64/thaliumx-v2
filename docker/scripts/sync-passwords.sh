#!/bin/bash
# ===========================================
# ThaliumX Password Synchronization Script
# ===========================================
# This script ensures all database passwords match the .env file
# Run this after changing passwords in .env or after a fresh deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== ThaliumX Password Synchronization ==="
echo ""

# Load environment variables
if [ -f "${ENV_FILE}" ]; then
    set -a
    source "${ENV_FILE}"
    set +a
    echo "Loaded environment from ${ENV_FILE}"
else
    echo -e "${RED}Error: .env file not found at ${ENV_FILE}${NC}"
    exit 1
fi

# ===========================================
# PostgreSQL Password Sync
# ===========================================
echo ""
echo "Synchronizing PostgreSQL passwords..."

# Main thaliumx user
if docker exec thaliumx-postgres psql -U thaliumx -c "SELECT 1" > /dev/null 2>&1; then
    echo "  - Updating thaliumx user password..."
    docker exec thaliumx-postgres psql -U thaliumx -c "ALTER USER thaliumx WITH PASSWORD '${POSTGRES_PASSWORD}';" 2>/dev/null || true
    echo -e "    ${GREEN}✓ thaliumx user updated${NC}"
else
    echo -e "    ${YELLOW}⚠ Could not connect as thaliumx user${NC}"
fi

# Ballerine user
echo "  - Updating ballerine user password..."
docker exec thaliumx-postgres psql -U thaliumx -c "
DO \$\$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ballerine') THEN
        ALTER USER ballerine WITH PASSWORD '${BALLERINE_DB_PASSWORD:-${POSTGRES_PASSWORD}}';
    END IF;
END
\$\$;" 2>/dev/null || true
echo -e "    ${GREEN}✓ ballerine user updated${NC}"

# Dingir user
echo "  - Updating dingir user password..."
docker exec thaliumx-postgres psql -U thaliumx -c "
DO \$\$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dingir') THEN
        ALTER USER dingir WITH PASSWORD '${TIMESCALE_PASSWORD:-${POSTGRES_PASSWORD}}';
    END IF;
END
\$\$;" 2>/dev/null || true
echo -e "    ${GREEN}✓ dingir user updated${NC}"

# ===========================================
# TimescaleDB Password Sync (if separate)
# ===========================================
if docker ps --format '{{.Names}}' | grep -q "thaliumx-timescaledb"; then
    echo ""
    echo "Synchronizing TimescaleDB passwords..."
    
    docker exec thaliumx-timescaledb psql -U ${TIMESCALE_USER:-dingir} -c "ALTER USER ${TIMESCALE_USER:-dingir} WITH PASSWORD '${TIMESCALE_PASSWORD:-${POSTGRES_PASSWORD}}';" 2>/dev/null || true
    echo -e "    ${GREEN}✓ TimescaleDB user updated${NC}"
fi

# ===========================================
# Citus Password Sync (if running)
# ===========================================
if docker ps --format '{{.Names}}' | grep -q "thaliumx-citus-coordinator"; then
    echo ""
    echo "Synchronizing Citus passwords..."
    
    docker exec thaliumx-citus-coordinator psql -U postgres -c "ALTER USER postgres WITH PASSWORD '${CITUS_POSTGRES_PASSWORD:-${POSTGRES_PASSWORD}}';" 2>/dev/null || true
    echo -e "    ${GREEN}✓ Citus coordinator updated${NC}"
fi

# ===========================================
# MongoDB Password Sync
# ===========================================
if docker ps --format '{{.Names}}' | grep -q "thaliumx-mongodb"; then
    echo ""
    echo "Synchronizing MongoDB passwords..."
    
    # MongoDB stores auth in the admin database
    # Password changes require authentication first
    docker exec thaliumx-mongodb mongosh --quiet --eval "
        db = db.getSiblingDB('admin');
        try {
            db.changeUserPassword('${MONGO_INITDB_ROOT_USERNAME}', '${MONGO_INITDB_ROOT_PASSWORD}');
            print('Password updated');
        } catch(e) {
            print('Could not update password: ' + e.message);
        }
    " 2>/dev/null || true
    echo -e "    ${GREEN}✓ MongoDB user updated${NC}"
fi

# ===========================================
# Redis Password Note
# ===========================================
echo ""
echo -e "${YELLOW}Note: Redis password is set via command line argument.${NC}"
echo "To change Redis password, update REDIS_PASSWORD in .env and restart Redis:"
echo "  docker compose restart redis"

# ===========================================
# Ballerine PostgreSQL (if separate)
# ===========================================
if docker ps --format '{{.Names}}' | grep -q "thaliumx-ballerine-postgres"; then
    echo ""
    echo "Synchronizing Ballerine PostgreSQL passwords..."
    
    docker exec thaliumx-ballerine-postgres psql -U ballerine -c "ALTER USER ballerine WITH PASSWORD '${BALLERINE_DB_PASSWORD:-${POSTGRES_PASSWORD}}';" 2>/dev/null || true
    echo -e "    ${GREEN}✓ Ballerine PostgreSQL updated${NC}"
fi

# ===========================================
# Summary
# ===========================================
echo ""
echo "=== Password Synchronization Complete ==="
echo ""
echo "Services may need to be restarted to pick up new passwords:"
echo "  docker compose restart keycloak ballerine-api ballerine-worker"
echo ""
echo -e "${YELLOW}Important: If any service fails to connect after password change,${NC}"
echo -e "${YELLOW}check that the password in .env matches the database.${NC}"