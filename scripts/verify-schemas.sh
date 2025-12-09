#!/bin/bash
# ThaliumX Database Schema Verification Script
# =============================================
# Verifies that all required schemas exist across all database services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CITUS_COORDINATOR="${CITUS_COORDINATOR:-thaliumx-citus-coordinator}"
TIMESCALEDB="${TIMESCALEDB:-thaliumx-timescaledb}"
KEYCLOAK_DB="${KEYCLOAK_DB:-thaliumx-keycloak-postgres}"
POSTGRES_USER="${POSTGRES_USER:-thaliumx}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ThaliumX2025}"
TIMESCALE_USER="${TIMESCALE_USER:-dingir}"
TIMESCALE_PASSWORD="${TIMESCALE_PASSWORD:-ThaliumX2025}"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_table_exists() {
    local container=$1
    local database=$2
    local table=$3
    local user=${4:-postgres}
    local password=${5:-ThaliumX2025}
    
    result=$(docker exec -e PGPASSWORD="$password" "$container" \
        psql -U "$user" -d "$database" -t -c \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null | tr -d ' ')
    
    if [ "$result" = "t" ]; then
        return 0
    else
        return 1
    fi
}

check_extension_exists() {
    local container=$1
    local database=$2
    local extension=$3
    local user=${4:-postgres}
    local password=${5:-ThaliumX2025}
    
    result=$(docker exec -e PGPASSWORD="$password" "$container" \
        psql -U "$user" -d "$database" -t -c \
        "SELECT EXISTS (SELECT FROM pg_extension WHERE extname = '$extension');" 2>/dev/null | tr -d ' ')
    
    if [ "$result" = "t" ]; then
        return 0
    else
        return 1
    fi
}

get_table_count() {
    local container=$1
    local database=$2
    local user=${3:-postgres}
    local password=${4:-ThaliumX2025}
    
    docker exec -e PGPASSWORD="$password" "$container" \
        psql -U "$user" -d "$database" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' '
}

# ============================================
# CITUS COORDINATOR SCHEMA VERIFICATION
# ============================================
verify_citus_schema() {
    print_header "Verifying Citus Coordinator Schema"
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "$CITUS_COORDINATOR"; then
        print_error "Citus coordinator container not running: $CITUS_COORDINATOR"
        return 1
    fi
    
    # Check Citus extension
    echo "Checking Citus extension..."
    if check_extension_exists "$CITUS_COORDINATOR" "thaliumx" "citus"; then
        print_success "Citus extension installed"
    else
        print_error "Citus extension NOT installed"
    fi
    
    # Check UUID extension
    if check_extension_exists "$CITUS_COORDINATOR" "thaliumx" "uuid-ossp"; then
        print_success "uuid-ossp extension installed"
    else
        print_error "uuid-ossp extension NOT installed"
    fi
    
    # Check pgcrypto extension
    if check_extension_exists "$CITUS_COORDINATOR" "thaliumx" "pgcrypto"; then
        print_success "pgcrypto extension installed"
    else
        print_error "pgcrypto extension NOT installed"
    fi
    
    # Required tables for multi-tenant architecture
    echo -e "\nChecking multi-tenant tables..."
    local citus_tables=("tenants" "users" "accounts" "transactions" "orders" "audit_logs")
    
    for table in "${citus_tables[@]}"; do
        if check_table_exists "$CITUS_COORDINATOR" "thaliumx" "$table"; then
            print_success "Table exists: $table"
        else
            print_error "Table MISSING: $table"
        fi
    done
    
    # Check Citus distribution
    echo -e "\nChecking Citus table distribution..."
    distributed_tables=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U postgres -d thaliumx -t -c \
        "SELECT COUNT(*) FROM citus_tables;" 2>/dev/null | tr -d ' ')
    
    if [ "$distributed_tables" -gt 0 ]; then
        print_success "Citus distributed tables: $distributed_tables"
    else
        print_warning "No distributed tables found - run 03-distribute-tables.sql"
    fi
    
    # Check worker nodes
    echo -e "\nChecking Citus worker nodes..."
    worker_count=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U postgres -d thaliumx -t -c \
        "SELECT COUNT(*) FROM citus_get_active_worker_nodes();" 2>/dev/null | tr -d ' ')
    
    if [ "$worker_count" -ge 2 ]; then
        print_success "Citus worker nodes active: $worker_count"
    else
        print_warning "Expected 2 worker nodes, found: $worker_count"
    fi
    
    # Check default tenant exists
    echo -e "\nChecking default tenant..."
    tenant_count=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U postgres -d thaliumx -t -c \
        "SELECT COUNT(*) FROM tenants;" 2>/dev/null | tr -d ' ')
    
    if [ "$tenant_count" -gt 0 ]; then
        print_success "Tenants found: $tenant_count"
    else
        print_warning "No tenants found - database may need seeding"
    fi
}

# ============================================
# TIMESCALEDB SCHEMA VERIFICATION (Dingir Trading Engine)
# ============================================
verify_timescaledb_schema() {
    print_header "Verifying TimescaleDB Schema (Dingir Trading Engine)"
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "$TIMESCALEDB"; then
        print_error "TimescaleDB container not running: $TIMESCALEDB"
        return 1
    fi
    
    # Check TimescaleDB extension
    echo "Checking TimescaleDB extension..."
    if check_extension_exists "$TIMESCALEDB" "exchange" "timescaledb" "$TIMESCALE_USER" "$TIMESCALE_PASSWORD" 2>/dev/null; then
        print_success "TimescaleDB extension installed"
    else
        print_error "TimescaleDB extension NOT installed"
    fi
    
    # Required tables for trading engine
    echo -e "\nChecking trading engine tables..."
    local dingir_tables=("asset" "market" "market_trade" "account" "kline" "order_history" "balance_history")
    
    for table in "${dingir_tables[@]}"; do
        if check_table_exists "$TIMESCALEDB" "exchange" "$table" "$TIMESCALE_USER" "$TIMESCALE_PASSWORD" 2>/dev/null; then
            print_success "Table exists: $table"
        else
            print_error "Table MISSING: $table"
        fi
    done
    
    # Check hypertables
    echo -e "\nChecking TimescaleDB hypertables..."
    hypertable_count=$(docker exec -e PGPASSWORD="$TIMESCALE_PASSWORD" "$TIMESCALEDB" \
        psql -U "$TIMESCALE_USER" -d exchange -t -c \
        "SELECT COUNT(*) FROM timescaledb_information.hypertables;" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$hypertable_count" -ge 4 ]; then
        print_success "Hypertables configured: $hypertable_count"
    else
        print_warning "Expected 4 hypertables, found: $hypertable_count"
    fi
    
    # Check for trading pairs
    echo -e "\nChecking trading pairs..."
    market_count=$(docker exec -e PGPASSWORD="$TIMESCALE_PASSWORD" "$TIMESCALEDB" \
        psql -U "$TIMESCALE_USER" -d exchange -t -c \
        "SELECT COUNT(*) FROM market;" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$market_count" -gt 0 ]; then
        print_success "Trading pairs configured: $market_count"
    else
        print_warning "No trading pairs found - need to seed market data"
    fi
    
    # Check for assets
    asset_count=$(docker exec -e PGPASSWORD="$TIMESCALE_PASSWORD" "$TIMESCALEDB" \
        psql -U "$TIMESCALE_USER" -d exchange -t -c \
        "SELECT COUNT(*) FROM asset;" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$asset_count" -gt 0 ]; then
        print_success "Assets configured: $asset_count"
    else
        print_warning "No assets found - need to seed asset data"
    fi
    
    # Check continuous aggregates
    echo -e "\nChecking continuous aggregates..."
    cagg_count=$(docker exec -e PGPASSWORD="$TIMESCALE_PASSWORD" "$TIMESCALEDB" \
        psql -U "$TIMESCALE_USER" -d exchange -t -c \
        "SELECT COUNT(*) FROM timescaledb_information.continuous_aggregates;" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$cagg_count" -ge 3 ]; then
        print_success "Continuous aggregates configured: $cagg_count (kline_1m, kline_1h, kline_1d)"
    else
        print_warning "Expected 3 continuous aggregates, found: $cagg_count"
    fi
}

# ============================================
# KEYCLOAK SCHEMA VERIFICATION
# ============================================
verify_keycloak_schema() {
    print_header "Verifying Keycloak Schema"
    
    # Check if Keycloak uses its own database or Citus
    if docker ps --format '{{.Names}}' | grep -q "$KEYCLOAK_DB"; then
        local kc_container="$KEYCLOAK_DB"
        local kc_database="keycloak"
    else
        # Keycloak might be using Citus
        local kc_container="$CITUS_COORDINATOR"
        local kc_database="keycloak"
    fi
    
    echo "Checking Keycloak database..."
    
    # Check if keycloak database exists
    db_exists=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$kc_container" \
        psql -U postgres -t -c \
        "SELECT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak');" 2>/dev/null | tr -d ' ')
    
    if [ "$db_exists" = "t" ]; then
        print_success "Keycloak database exists"
        
        # Check key Keycloak tables
        local kc_tables=("realm" "client" "user_entity" "credential" "user_role_mapping")
        
        for table in "${kc_tables[@]}"; do
            if check_table_exists "$kc_container" "keycloak" "$table"; then
                print_success "Keycloak table exists: $table"
            else
                print_warning "Keycloak table not found: $table (Keycloak auto-creates on startup)"
            fi
        done
        
        # Check realm count
        realm_count=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$kc_container" \
            psql -U postgres -d keycloak -t -c \
            "SELECT COUNT(*) FROM realm;" 2>/dev/null | tr -d ' ' || echo "0")
        
        if [ "$realm_count" -gt 0 ]; then
            print_success "Keycloak realms configured: $realm_count"
        else
            print_warning "No Keycloak realms found - import realm configuration"
        fi
    else
        print_warning "Keycloak database not found - Keycloak will create on first startup"
    fi
}

# ============================================
# BACKEND APPLICATION SCHEMA VERIFICATION
# ============================================
verify_backend_schema() {
    print_header "Verifying Backend Application Schema"
    
    # Check Sequelize migrations table
    echo "Checking Sequelize migrations..."
    if check_table_exists "$CITUS_COORDINATOR" "thaliumx" "SequelizeMeta"; then
        print_success "Sequelize migrations table exists"
        
        # Count migrations
        migration_count=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
            psql -U postgres -d thaliumx -t -c \
            "SELECT COUNT(*) FROM \"SequelizeMeta\";" 2>/dev/null | tr -d ' ')
        
        print_success "Migrations applied: $migration_count"
    else
        print_warning "Sequelize migrations table not found - run migrations"
    fi
    
    # Check backend-specific tables
    echo -e "\nChecking backend application tables..."
    local backend_tables=("trading_pairs" "kyc_verifications" "wallets" "margin_accounts" "compliance_records")
    
    for table in "${backend_tables[@]}"; do
        if check_table_exists "$CITUS_COORDINATOR" "thaliumx" "$table"; then
            print_success "Table exists: $table"
        else
            print_warning "Table not found: $table (may need migration)"
        fi
    done
}

# ============================================
# MONGODB SCHEMA VERIFICATION
# ============================================
verify_mongodb_schema() {
    print_header "Verifying MongoDB Schema"
    
    local mongo_container="thaliumx-mongodb"
    
    if ! docker ps --format '{{.Names}}' | grep -q "$mongo_container"; then
        print_error "MongoDB container not running: $mongo_container"
        return 1
    fi
    
    echo "Checking MongoDB collections..."
    
    # List collections
    collections=$(docker exec "$mongo_container" mongosh --quiet --eval \
        "db.getSiblingDB('thaliumx').getCollectionNames().join(',')" 2>/dev/null || echo "")
    
    if [ -n "$collections" ]; then
        print_success "MongoDB collections found: $collections"
    else
        print_warning "No MongoDB collections found - will be created on first use"
    fi
    
    # Check expected collections
    local expected_collections=("documents" "notifications" "configurations" "audit_logs")
    
    for coll in "${expected_collections[@]}"; do
        if echo "$collections" | grep -q "$coll"; then
            print_success "Collection exists: $coll"
        else
            print_warning "Collection not found: $coll (will be created on first use)"
        fi
    done
}

# ============================================
# REDIS VERIFICATION
# ============================================
verify_redis() {
    print_header "Verifying Redis"
    
    local redis_container="thaliumx-redis"
    
    if ! docker ps --format '{{.Names}}' | grep -q "$redis_container"; then
        print_error "Redis container not running: $redis_container"
        return 1
    fi
    
    # Check Redis connectivity
    redis_ping=$(docker exec "$redis_container" redis-cli -a "$POSTGRES_PASSWORD" PING 2>/dev/null || echo "FAIL")
    
    if [ "$redis_ping" = "PONG" ]; then
        print_success "Redis is responding"
    else
        print_error "Redis not responding"
    fi
    
    # Check Redis info
    redis_keys=$(docker exec "$redis_container" redis-cli -a "$POSTGRES_PASSWORD" DBSIZE 2>/dev/null | grep -oP '\d+' || echo "0")
    print_success "Redis keys: $redis_keys"
}

# ============================================
# GENERATE SCHEMA REPORT
# ============================================
generate_report() {
    print_header "Schema Verification Summary"
    
    echo -e "\n${BLUE}Results:${NC}"
    echo -e "  Total checks: $TOTAL_CHECKS"
    echo -e "  ${GREEN}Passed: $PASSED_CHECKS${NC}"
    echo -e "  ${RED}Failed: $FAILED_CHECKS${NC}"
    echo -e "  ${YELLOW}Warnings: $WARNINGS${NC}"
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "\n${GREEN}✓ All critical schema checks passed!${NC}"
        return 0
    else
        echo -e "\n${RED}✗ Some schema checks failed. Please review and fix.${NC}"
        return 1
    fi
}

# ============================================
# MAIN
# ============================================
main() {
    print_header "ThaliumX Database Schema Verification"
    echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    
    verify_citus_schema
    verify_timescaledb_schema
    verify_keycloak_schema
    verify_backend_schema
    verify_mongodb_schema
    verify_redis
    
    generate_report
}

# Run main
main "$@"